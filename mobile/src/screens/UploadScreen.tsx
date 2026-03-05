import { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, FileText, X, Upload as UploadIcon } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { parseWhatsAppChat, formatChatForAI } from '../lib/chatParser';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface SelectedFile {
    name: string;
    uri: string;
    size: number;
}

export default function UploadScreen() {
    const navigation = useNavigation<Nav>();
    const [file, setFile] = useState<SelectedFile | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [uploading, setUploading] = useState(false);

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/plain', 'application/zip', '*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.length) return;

            const asset = result.assets[0];
            const ext = asset.name.substring(asset.name.lastIndexOf('.')).toLowerCase();
            if (!['.txt', '.zip'].includes(ext)) {
                return Alert.alert('Invalid file', 'Please upload a .txt or .zip file.');
            }
            if (asset.size && asset.size > 20 * 1024 * 1024) {
                return Alert.alert('File too large', 'Maximum file size is 20 MB.');
            }
            setFile({ name: asset.name, uri: asset.uri, size: asset.size ?? 0 });
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not pick file.');
        }
    };

    /**
     * Resolves any URI (content://, file://) to a readable file:// URI.
     * On Android, content:// URIs from the document picker must be copied
     * to the app cache before expo-file-system can read them as text.
     */
    const resolveFileUri = async (uri: string, filename: string): Promise<string> => {
        if (Platform.OS === 'android' && uri.startsWith('content://')) {
            const destUri = `${FileSystem.cacheDirectory}rna_${Date.now()}_${filename}`;
            await FileSystem.copyAsync({ from: uri, to: destUri });
            return destUri;
        }
        return uri;
    };

    const handleUpload = async () => {
        if (!file) return;
        if (file.name.endsWith('.zip')) {
            return Alert.alert('ZIP not supported yet', 'Please extract and upload the .txt file directly.');
        }

        setUploading(true);
        setProgress(5);
        setStatusText('Authenticating…');

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw new Error(`Auth error: ${authError.message}`);
            if (!user) throw new Error('Not authenticated. Please log in again.');

            setProgress(15);
            setStatusText('Reading file…');

            // Resolve content:// → file:// on Android so FileSystem can read it
            const readableUri = await resolveFileUri(file.uri, file.name);

            const chatText = await FileSystem.readAsStringAsync(readableUri, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            if (!chatText || chatText.trim().length === 0) {
                throw new Error('File appears to be empty.');
            }

            setProgress(30);
            setStatusText('Parsing chat…');

            const parsed = parseWhatsAppChat(chatText);
            if (parsed.messages.length === 0) {
                throw new Error('Could not parse any messages. Make sure this is a valid WhatsApp export (.txt).');
            }

            const friendlyName =
                parsed.participants.length > 0
                    ? parsed.participants.join(' & ') + '.txt'
                    : file.name;

            setProgress(45);
            setStatusText('Uploading file…');

            const sanitizedName = friendlyName.replace(/[^\w.\-]/g, '_');
            const filePath = `${user.id}/${Date.now()}_${sanitizedName}`;

            // Get the user's auth token for the upload request
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token ?? '';

            // Use FileSystem.uploadAsync — this is the only reliable way to upload
            // binary files to a remote server from React Native/Expo. The Supabase
            // storage SDK uses fetch+Blob internally, which fails on Android.
            const storageUrl = `${SUPABASE_URL}/storage/v1/object/chat-files/${filePath}`;
            const uploadResult = await FileSystem.uploadAsync(storageUrl, readableUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_ANON_KEY,
                    'Content-Type': 'text/plain',
                    'x-upsert': 'false',
                },
            });

            if (uploadResult.status !== 200 && uploadResult.status !== 201) {
                throw new Error(`Storage error: ${uploadResult.body || uploadResult.status}`);
            }

            setProgress(60);
            setStatusText('Saving metadata…');

            const { data: upload, error: uploadError } = await supabase
                .from('chat_uploads')
                .insert({
                    user_id: user.id,
                    filename: friendlyName,
                    file_path: filePath,
                    status: 'parsing',
                    message_count: parsed.messages.length,
                    participant_count: parsed.participants.length,
                })
                .select()
                .single();

            if (uploadError) throw new Error(`Database error: ${uploadError.message}`);

            setProgress(75);
            setStatusText('Analyzing with AI…');

            const chatForAI = formatChatForAI(parsed.messages);
            const { error: fnError } = await supabase.functions.invoke('analyze-chat', {
                body: {
                    uploadId: (upload as any).id,
                    chatText: chatForAI,
                    participants: parsed.participants,
                },
            });

            if (fnError) throw new Error(`Analysis error: ${fnError.message}`);

            setProgress(100);
            setStatusText('Complete! 🎉');

            setTimeout(() => {
                navigation.replace('Analysis', { uploadId: (upload as any).id });
            }, 800);
        } catch (err: any) {
            const msg = err?.message || 'Something went wrong.';
            // Include the step so it's easier to diagnose
            Alert.alert('Upload failed', `${msg}\n\n(Failed during: ${statusText || 'startup'})`);
            setUploading(false);
            setProgress(0);
            setStatusText('');
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Upload Chat Export</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Drop zone / pick area */}
                <TouchableOpacity
                    style={[styles.dropZone, file && styles.dropZoneFilled]}
                    onPress={!uploading ? pickFile : undefined}
                    activeOpacity={0.8}
                    disabled={uploading}
                >
                    <UploadIcon size={40} color={file ? Colors.primary : Colors.textMuted} />
                    <Text style={styles.dropTitle}>
                        {file ? 'Tap to change file' : 'Tap to select your chat export'}
                    </Text>
                    <Text style={styles.dropSubtitle}>
                        Supports WhatsApp .txt exports (max 20 MB)
                    </Text>
                </TouchableOpacity>

                {/* Selected file card */}
                {file && !uploading && (
                    <View style={styles.fileCard}>
                        <FileText size={32} color={Colors.primary} />
                        <View style={styles.fileInfo}>
                            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                            <Text style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</Text>
                        </View>
                        <TouchableOpacity style={styles.removeBtn} onPress={() => setFile(null)}>
                            <X size={18} color={Colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Progress */}
                {uploading && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBg}>
                            <View style={[styles.progressBar, { width: `${progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{statusText}</Text>
                    </View>
                )}

                {/* Upload button */}
                {file && !uploading && (
                    <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} activeOpacity={0.85}>
                        <UploadIcon size={18} color="#FFF" />
                        <Text style={styles.uploadBtnText}>Analyze Chat</Text>
                    </TouchableOpacity>
                )}

                {/* Instructions */}
                <View style={styles.instructionsCard}>
                    <Text style={styles.instructionsTitle}>How to export WhatsApp chats:</Text>
                    {[
                        '1. Open a WhatsApp chat',
                        '2. Tap ⋮ → More → Export chat',
                        '3. Choose "Without Media"',
                        '4. Select the .txt file and upload it here',
                    ].map((step, i) => (
                        <Text key={i} style={styles.instructionStep}>{step}</Text>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        ...Shadow.sm,
    },
    backBtn: { padding: 4 },
    headerTitle: { ...Typography.h4 },

    container: { padding: Spacing.lg, gap: Spacing.lg },

    dropZone: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: Colors.border,
        borderRadius: Radius.lg,
        padding: 48,
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.card,
    },
    dropZoneFilled: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryLight,
    },
    dropTitle: { ...Typography.h4, textAlign: 'center' },
    dropSubtitle: { ...Typography.bodySmall, textAlign: 'center' },

    fileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadow.sm,
    },
    fileInfo: { flex: 1, minWidth: 0 },
    fileName: { fontSize: 14, fontWeight: '500', color: Colors.text },
    fileSize: { ...Typography.bodySmall, marginTop: 2 },
    removeBtn: { padding: 6 },

    progressContainer: { gap: Spacing.sm },
    progressBg: {
        height: 8,
        borderRadius: Radius.full,
        backgroundColor: Colors.border,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: Radius.full,
    },
    progressText: { ...Typography.bodySmall, textAlign: 'center' },

    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        paddingVertical: 16,
        ...Shadow.sm,
    },
    uploadBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

    instructionsCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    instructionsTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
    instructionStep: { ...Typography.bodySmall, lineHeight: 18 },
});
