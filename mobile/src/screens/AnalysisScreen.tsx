import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Switch, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft, Download, Users, Heart, Briefcase, Home,
  UserCircle, Edit, Save, X, Eye, EyeOff,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Analysis'>;

interface Characteristic {
  name: string;
  traits: string[];
  description: string;
  messageCount?: number;
  topEmojis?: string[];
  dominantTone?: string;
}

interface Relationship {
  person1: string;
  person2: string;
  type: string;
  strength: number;
  description: string;
}

interface Analysis {
  id: string;
  upload_id: string;
  summary: string;
  characteristics: Characteristic[];
  relationships: Relationship[];
  participants: string[];
  anonymized: boolean;
  anonymized_map: Record<string, string>;
}

type TabKey = 'summary' | 'profiles' | 'relationships';

const relationshipIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'friends': return <Heart size={16} color={Colors.primary} />;
    case 'professional': return <Briefcase size={16} color={Colors.primary} />;
    case 'family': return <Home size={16} color={Colors.primary} />;
    default: return <Users size={16} color={Colors.primary} />;
  }
};

export default function AnalysisScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { uploadId } = route.params;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [upload, setUpload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [anonymized, setAnonymized] = useState(false);

  useEffect(() => { loadAnalysis(); }, [uploadId]);

  const loadAnalysis = async () => {
    const { data: uploadData } = await supabase
      .from('chat_uploads').select('*').eq('id', uploadId).single();
    const { data: analysisData } = await supabase
      .from('chat_analyses').select('*').eq('upload_id', uploadId).single();

    setUpload(uploadData);
    if (analysisData) {
      const a = analysisData as any;
      setAnalysis({
        ...a,
        characteristics: Array.isArray(a.characteristics) ? a.characteristics : [],
        relationships: Array.isArray(a.relationships) ? a.relationships : [],
        participants: Array.isArray(a.participants) ? a.participants : [],
        anonymized_map: a.anonymized_map || {},
      });
      setAnonymized(a.anonymized || false);
    }
    setLoading(false);
  };

  const getDisplayName = (name: string) => {
    if (!anonymized || !analysis) return name;
    if (!analysis.anonymized_map[name]) {
      const idx = analysis.participants.indexOf(name);
      return `Person ${String.fromCharCode(65 + (idx >= 0 ? idx : 0))}`;
    }
    return analysis.anonymized_map[name];
  };

  const toggleAnonymize = async () => {
    if (!analysis) return;
    const newVal = !anonymized;
    setAnonymized(newVal);
    const nameMap: Record<string, string> = {};
    analysis.participants.forEach((name, i) => {
      nameMap[name] = `Person ${String.fromCharCode(65 + i)}`;
    });
    await supabase.from('chat_analyses')
      .update({ anonymized: newVal, anonymized_map: nameMap })
      .eq('id', analysis.id);
  };

  const saveSummary = async () => {
    if (!analysis) return;
    await supabase.from('chat_analyses').update({ summary: summaryDraft }).eq('id', analysis.id);
    setAnalysis({ ...analysis, summary: summaryDraft });
    setEditingSummary(false);
  };

  const exportReport = async () => {
    if (!analysis) return;
    const lines: string[] = [
      `CHAT ANALYSIS REPORT`,
      `File: ${upload?.filename}`,
      `Messages: ${upload?.message_count}`,
      `Participants: ${analysis.participants.length}`,
      '',
      '=== SUMMARY ===',
      analysis.summary || 'No summary available.',
      '',
      '=== PARTICIPANT PROFILES ===',
      ...analysis.characteristics.map(c => [
        `\n${getDisplayName(c.name)}`,
        `Tone: ${c.dominantTone || 'N/A'}`,
        `Traits: ${c.traits.join(', ')}`,
        c.description,
        c.messageCount ? `Messages: ${c.messageCount}` : '',
      ].join('\n')),
      '',
      '=== RELATIONSHIPS ===',
      ...analysis.relationships.map(r =>
        `${getDisplayName(r.person1)} ↔ ${getDisplayName(r.person2)} (${r.type}, strength: ${r.strength}/10)\n${r.description}`
      ),
    ];

    const reportText = lines.join('\n');
    const fileUri = `${FileSystem.cacheDirectory}analysis_report.txt`;
    await FileSystem.writeAsStringAsync(fileUri, reportText);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Export Analysis' });
    } else {
      Alert.alert('Sharing not available', 'Could not open share dialog on this device.');
    }
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'profiles', label: 'Profiles' },
    { key: 'relationships', label: 'Relationships' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Analysis not found or still processing.</Text>
          <TouchableOpacity style={styles.backBtnLarge} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={Colors.primary} />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>{upload?.filename}</Text>
          <Text style={styles.headerSub}>
            {upload?.message_count} msg · {analysis.participants.length} participants
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.anonRow}>
            {anonymized ? <EyeOff size={15} color={Colors.textMuted} /> : <Eye size={15} color={Colors.textMuted} />}
            <Switch
              value={anonymized}
              onValueChange={toggleAnonymize}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#FFF"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          <TouchableOpacity onPress={exportReport} style={styles.exportBtn}>
            <Download size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Conversation Summary</Text>
              {!editingSummary ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => { setSummaryDraft(analysis.summary || ''); setEditingSummary(true); }}
                >
                  <Edit size={16} color={Colors.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setEditingSummary(false)} style={styles.iconBtn}>
                    <X size={18} color={Colors.destructive} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveSummary} style={styles.saveBtn}>
                    <Save size={14} color="#FFF" />
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {editingSummary ? (
              <TextInput
                style={styles.summaryInput}
                value={summaryDraft}
                onChangeText={setSummaryDraft}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.summaryText}>{analysis.summary || 'No summary available.'}</Text>
            )}
          </View>
        )}

        {/* Profiles Tab */}
        {activeTab === 'profiles' && (
          <>
            {analysis.characteristics.map((char, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.profileHeader}>
                  <View style={styles.profileIcon}>
                    <UserCircle size={26} color={Colors.primary} />
                  </View>
                  <View style={styles.profileMeta}>
                    <Text style={styles.profileName}>{getDisplayName(char.name)}</Text>
                    {char.dominantTone && (
                      <Text style={styles.profileTone}>{char.dominantTone}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.traitRow}>
                  {char.traits.map((trait, j) => (
                    <View key={j} style={styles.traitBadge}>
                      <Text style={styles.traitText}>{trait}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.profileDesc}>{char.description}</Text>
                {char.topEmojis && char.topEmojis.length > 0 && (
                  <Text style={styles.emojiLine}>Top emojis: {char.topEmojis.join(' ')}</Text>
                )}
                {char.messageCount ? (
                  <Text style={styles.msgCount}>{char.messageCount} messages</Text>
                ) : null}
              </View>
            ))}
          </>
        )}

        {/* Relationships Tab */}
        {activeTab === 'relationships' && (
          <>
            {analysis.relationships.length === 0 && (
              <Text style={styles.emptyText}>No relationships detected.</Text>
            )}
            {analysis.relationships.map((rel, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.relHeader}>
                  <View style={styles.relIconWrap}>
                    {relationshipIcon(rel.type)}
                  </View>
                  <View style={styles.relPeople}>
                    <Text style={styles.relNames}>
                      {getDisplayName(rel.person1)} ↔ {getDisplayName(rel.person2)}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: Colors.primaryLight }]}>
                      <Text style={styles.typeText}>{rel.type}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.relDesc}>{rel.description}</Text>
                {/* Strength bar */}
                <View style={styles.strengthRow}>
                  <Text style={styles.strengthLabel}>Strength</Text>
                  <View style={styles.strengthBg}>
                    <View style={[styles.strengthBar, { width: `${(rel.strength / 10) * 100}%` }]} />
                  </View>
                  <Text style={styles.strengthValue}>{rel.strength}/10</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { ...Typography.body, color: Colors.textMuted },
  backBtnLarge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  backBtn: { padding: 6 },
  headerMid: { flex: 1, marginHorizontal: Spacing.sm },
  headerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exportBtn: { padding: 6 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  tab: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },

  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardTitle: { ...Typography.h4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 4 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  saveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  summaryInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    minHeight: 180,
    backgroundColor: '#FAFAFA',
  },
  summaryText: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  profileIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: { flex: 1 },
  profileName: { ...Typography.h4 },
  profileTone: { ...Typography.bodySmall, marginTop: 2 },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  traitBadge: {
    backgroundColor: Colors.badge,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  traitText: { fontSize: 12, color: Colors.badgeText, fontWeight: '500' },
  profileDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 20, marginBottom: Spacing.sm },
  emojiLine: { fontSize: 14, marginBottom: 4 },
  msgCount: { ...Typography.caption },

  relHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  relIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relPeople: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  relNames: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  relDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 20, marginBottom: Spacing.md },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  strengthLabel: { ...Typography.caption, width: 55 },
  strengthBg: { flex: 1, height: 8, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  strengthBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  strengthValue: { fontSize: 12, fontWeight: '600', color: Colors.text, width: 38 },

  emptyText: { textAlign: 'center', ...Typography.body, color: Colors.textMuted, paddingTop: 32 },
});
