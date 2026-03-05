import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Share, TextInput, Modal,
  ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Upload, LogOut, MessageCircle, Clock, Users, Trash2,
  FolderSync, Share2, Copy, Check,   Network,
  Home, Handshake, Briefcase, ChevronRight,
} from 'lucide-react-native';
import { format } from 'date-fns';
import * as Clipboard from 'expo-clipboard';

import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ChatUpload {
  id: string;
  filename: string;
  status: string;
  message_count: number;
  participant_count: number;
  created_at: string;
  category?: string;
}

const CATEGORIES = [
  { key: 'family', label: 'Family', color: Colors.family, bg: Colors.familyLight, border: Colors.familyBorder },
  { key: 'friends', label: 'Friends', color: Colors.friends, bg: Colors.friendsLight, border: Colors.friendsBorder },
  { key: 'professional', label: 'Professional', color: Colors.professional, bg: Colors.professionalLight, border: Colors.professionalBorder },
];

const statusColor = (status: string) => {
  switch (status) {
    case 'completed': return Colors.success;
    case 'error': return Colors.destructive;
    case 'analyzing': return Colors.warning;
    default: return Colors.textMuted;
  }
};

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [uploads, setUploads] = useState<ChatUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [catModalUpload, setCatModalUpload] = useState<ChatUpload | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('id', user.id).single();
    setUserName(profile?.display_name || user.email?.split('@')[0] || 'User');

    const { data: uploadsData } = await supabase
      .from('chat_uploads').select('*').order('created_at', { ascending: false });

    const { data: analysesData } = await supabase
      .from('chat_analyses').select('upload_id, relationships');

    const categoryMap = new Map<string, string>();
    if (analysesData) {
      for (const a of analysesData as any[]) {
        const rels = Array.isArray(a.relationships) ? a.relationships : [];
        if (!rels.length) continue;
        const counts: Record<string, number> = {};
        for (const r of rels) {
          const t = (r.type || 'other').toLowerCase();
          const mapped = t === 'romantic' ? 'friends' : t === 'acquaintances' ? 'friends' : t;
          counts[mapped] = (counts[mapped] || 0) + 1;
        }
        const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'friends';
        categoryMap.set(a.upload_id, dominant);
      }
    }

    const enriched = ((uploadsData as any[]) || []).map(u => ({
      ...u,
      category: u.category_override || categoryMap.get(u.id) || 'uncategorized',
    }));

    setUploads(enriched);
    setLoading(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleDelete = (upload: ChatUpload) => {
    Alert.alert('Delete Chat', `Delete "${upload.filename}" and its analysis?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('chat_analyses').delete().eq('upload_id', upload.id);
          const { error } = await supabase.from('chat_uploads').delete().eq('id', upload.id);
          if (!error) setUploads(prev => prev.filter(u => u.id !== upload.id));
          else Alert.alert('Error', 'Could not delete the chat.');
        },
      },
    ]);
  };

  const handleCategoryChange = async (uploadId: string, newCategory: string) => {
    setCatModalUpload(null);
    await supabase.from('chat_uploads').update({ category_override: newCategory } as any).eq('id', uploadId);
    setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, category: newCategory } : u));
  };

  const handleShare = async () => {
    setShareLoading(true);
    setShareModalVisible(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('dashboard_shares').select('token').eq('owner_id', user.id).limit(1);

      let token: string;
      if (existing && existing.length > 0) {
        token = (existing[0] as any).token;
      } else {
        const { data, error } = await supabase
          .from('dashboard_shares').insert({ owner_id: user.id } as any)
          .select('token').single();
        if (error) throw error;
        token = (data as any).token;
      }
      setShareLink(`https://jlwrbbevbugurtkkojfx.supabase.co/shared/${token}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderUploadCard = (upload: ChatUpload) => (
    <TouchableOpacity
      key={upload.id}
      style={styles.uploadCard}
      onPress={() => upload.status === 'completed' && navigation.navigate('Analysis', { uploadId: upload.id })}
      activeOpacity={upload.status === 'completed' ? 0.8 : 1}
    >
      <View style={styles.uploadCardInner}>
        <View style={styles.uploadIconWrap}>
          <MessageCircle size={20} color={Colors.primary} />
        </View>
        <View style={styles.uploadInfo}>
          <Text style={styles.uploadName} numberOfLines={1}>{upload.filename}</Text>
          <View style={styles.uploadMeta}>
            <Clock size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{format(new Date(upload.created_at), 'MMM d')}</Text>
            <MessageCircle size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{upload.message_count}</Text>
            <Users size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{upload.participant_count}</Text>
          </View>
        </View>
        <View style={styles.uploadActions}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(upload.status) + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor(upload.status) }]}>
              {upload.status}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setCatModalUpload(upload)}>
            <FolderSync size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(upload)}>
            <Trash2 size={16} color={Colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategory = (catKey: string, catLabel: string, catColor: string, catBg: string, catBorder: string) => {
    const items = uploads.filter(u => u.category === catKey);
    if (!items.length) return null;
    return (
      <View key={catKey} style={[styles.categorySection, { backgroundColor: catBg, borderColor: catBorder }]}>
        <View style={styles.categoryHeader}>
          <Text style={[styles.categoryLabel, { color: catColor }]}>{catLabel.toUpperCase()}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: catColor + '20' }]}>
            <Text style={[styles.categoryCount, { color: catColor }]}>{items.length}</Text>
          </View>
        </View>
        {items.map(renderUploadCard)}
      </View>
    );
  };

  const uncategorized = uploads.filter(u => u.category === 'uncategorized');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <MessageCircle size={20} color="#FFF" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Relationship Analyzer</Text>
            <Text style={styles.headerSub}>Welcome, {userName}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
            <Share2 size={18} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Matrix')}>
            <Users size={18} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Feedback')}>
            <ChevronRight size={18} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleLogout}>
            <LogOut size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Analyses</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('Upload')}>
            <Upload size={14} color="#FFF" />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : uploads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Network size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No chats analyzed yet</Text>
            <Text style={styles.emptyDesc}>Upload a WhatsApp chat export to get started</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Upload')}>
              <Upload size={16} color="#FFF" />
              <Text style={styles.primaryBtnText}>Upload Your First Chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {CATEGORIES.map(c => renderCategory(c.key, c.label, c.color, c.bg, c.border))}
            {uncategorized.length > 0 && (
              <View style={[styles.categorySection, { backgroundColor: Colors.otherLight, borderColor: Colors.otherBorder }]}>
                <View style={styles.categoryHeader}>
                  <Text style={[styles.categoryLabel, { color: Colors.other }]}>OTHER</Text>
                  <View style={[styles.categoryBadge, { backgroundColor: Colors.other + '20' }]}>
                    <Text style={[styles.categoryCount, { color: Colors.other }]}>{uncategorized.length}</Text>
                  </View>
                </View>
                {uncategorized.map(renderUploadCard)}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Share Modal */}
      <Modal visible={shareModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShareModalVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Share your dashboard</Text>
            <Text style={styles.modalDesc}>Anyone with this link can view your analyses after signing in.</Text>
            {shareLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : shareLink ? (
              <View style={styles.linkRow}>
                <TextInput
                  style={styles.linkInput}
                  value={shareLink}
                  editable={false}
                  selectTextOnFocus
                  numberOfLines={1}
                />
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                  {copied ? <Check size={18} color={Colors.success} /> : <Copy size={18} color={Colors.primary} />}
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShareModalVisible(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={!!catModalUpload} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCatModalUpload(null)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Move to category</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catOption, catModalUpload?.category === cat.key && { backgroundColor: cat.bg }]}
                onPress={() => catModalUpload && handleCategoryChange(catModalUpload.id, cat.key)}
              >
                <Text style={[styles.catOptionText, catModalUpload?.category === cat.key && { color: cat.color, fontWeight: '600' }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setCatModalUpload(null)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn: { padding: 8 },

  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg, paddingBottom: 40 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.h3 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  uploadBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: { ...Typography.h4 },
  emptyDesc: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  categorySection: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  categoryBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  categoryCount: { fontSize: 11, fontWeight: '600' },

  uploadCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadInfo: { flex: 1, minWidth: 0 },
  uploadName: { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 3 },
  uploadMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: Colors.textMuted, marginRight: 4 },
  uploadActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '600' },
  iconBtn: { padding: 6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    ...Shadow.md,
  },
  modalTitle: { ...Typography.h4, marginBottom: Spacing.sm },
  modalDesc: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.lg },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  linkInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.text,
  },
  copyBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  closeModalBtn: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeModalText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  catOption: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  catOptionText: { fontSize: 15, color: Colors.text },
});
