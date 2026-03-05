import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, MessageSquareText, Users, Smile, TrendingUp, Network } from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface PersonProfile {
  name: string;
  totalMessages: number;
  traits: string[];
  tones: string[];
  topEmojis: string[];
  relationshipTypes: string[];
  avgStrength: number;
  descriptions: string[];
  chatSources: string[];
}

const strengthStyle = (s: number): { bg: string; text: string } => {
  if (s >= 7) return { bg: Colors.successLight, text: Colors.success };
  if (s >= 4) return { bg: Colors.primaryLight, text: Colors.primary };
  return { bg: Colors.badge, text: Colors.badgeText };
};

export default function CommunicationMatrixScreen() {
  const navigation = useNavigation<Nav>();
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMatrix(); }, []);

  const loadMatrix = async () => {
    const { data: analyses } = await supabase
      .from('chat_analyses')
      .select('*, chat_uploads!chat_analyses_upload_id_fkey(filename)');

    if (!analyses || analyses.length === 0) { setLoading(false); return; }

    const profileMap = new Map<string, PersonProfile>();

    for (const analysis of analyses) {
      const chars = Array.isArray(analysis.characteristics) ? analysis.characteristics as any[] : [];
      const rels = Array.isArray(analysis.relationships) ? analysis.relationships as any[] : [];
      const filename = (analysis as any).chat_uploads?.filename || 'Unknown';

      for (const char of chars) {
        const existing: PersonProfile = profileMap.get(char.name) || {
          name: char.name, totalMessages: 0, traits: [], tones: [],
          topEmojis: [], relationshipTypes: [], avgStrength: 0,
          descriptions: [], chatSources: [],
        };
        existing.totalMessages += char.messageCount || 0;
        existing.traits.push(...(char.traits || []));
        if (char.dominantTone) existing.tones.push(char.dominantTone);
        if (char.topEmojis) existing.topEmojis.push(...char.topEmojis);
        existing.descriptions.push(char.description);
        if (!existing.chatSources.includes(filename)) existing.chatSources.push(filename);
        profileMap.set(char.name, existing);
      }

      for (const rel of rels) {
        for (const person of [rel.person1, rel.person2]) {
          const existing = profileMap.get(person);
          if (existing) {
            if (!existing.relationshipTypes.includes(rel.type)) existing.relationshipTypes.push(rel.type);
            existing.avgStrength = existing.avgStrength
              ? (existing.avgStrength + rel.strength) / 2
              : rel.strength;
          }
        }
      }
    }

    for (const [, profile] of profileMap) {
      profile.traits = [...new Set(profile.traits)];
      profile.topEmojis = [...new Set(profile.topEmojis)].slice(0, 5);
      profile.tones = [...new Set(profile.tones)];
    }

    setProfiles([...profileMap.values()].sort((a, b) => b.totalMessages - a.totalMessages));
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Communication Matrix</Text>
          <Text style={styles.headerSub}>Your style across all conversations</Text>
        </View>
        <TouchableOpacity
          style={styles.webBtn}
          onPress={() => navigation.navigate('MyRelationships')}
        >
          <Users size={15} color={Colors.primary} />
          <Text style={styles.webBtnText}>My Web</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptyDesc}>Upload and analyze chats to see your communication matrix</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('Upload')}>
              <Text style={styles.uploadBtnText}>Upload a Chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.map(person => {
            const ss = strengthStyle(person.avgStrength);
            return (
              <View key={person.name} style={styles.card}>
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <View style={styles.msgRow}>
                      <MessageSquareText size={12} color={Colors.textMuted} />
                      <Text style={styles.msgText}>{person.totalMessages} messages</Text>
                      {person.chatSources.length > 1 && (
                        <Text style={styles.msgText}>• {person.chatSources.length} chats</Text>
                      )}
                    </View>
                  </View>
                  {person.avgStrength > 0 && (
                    <View style={[styles.strengthChip, { backgroundColor: ss.bg }]}>
                      <TrendingUp size={11} color={ss.text} />
                      <Text style={[styles.strengthChipText, { color: ss.text }]}>
                        {person.avgStrength.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Tones */}
                {person.tones.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>TONE</Text>
                    <View style={styles.tagRow}>
                      {person.tones.map((tone, i) => (
                        <View key={i} style={[styles.tag, { borderColor: Colors.primary + '40' }]}>
                          <Text style={[styles.tagText, { color: Colors.primary }]}>{tone}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Traits */}
                {person.traits.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>TRAITS</Text>
                    <View style={styles.tagRow}>
                      {person.traits.slice(0, 6).map((trait, i) => (
                        <View key={i} style={styles.traitTag}>
                          <Text style={styles.traitTagText}>{trait}</Text>
                        </View>
                      ))}
                      {person.traits.length > 6 && (
                        <View style={styles.traitTag}>
                          <Text style={styles.traitTagText}>+{person.traits.length - 6}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Emojis */}
                {person.topEmojis.length > 0 && (
                  <View style={styles.emojiRow}>
                    <Smile size={14} color={Colors.textMuted} />
                    <Text style={styles.emojiText}>{person.topEmojis.join(' ')}</Text>
                  </View>
                )}

                {/* Relationship types */}
                {person.relationshipTypes.length > 0 && (
                  <View style={styles.relRow}>
                    <Users size={12} color={Colors.textMuted} />
                    <Text style={styles.relText}>{person.relationshipTypes.join(', ')}</Text>
                  </View>
                )}

                {/* Description */}
                {person.descriptions.length > 0 && (
                  <Text style={styles.descText} numberOfLines={2}>{person.descriptions[0]}</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  backBtn: { padding: 4 },
  headerMid: { flex: 1, marginLeft: Spacing.sm },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted },
  webBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  webBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },

  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: { ...Typography.h4 },
  emptyDesc: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  uploadBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    marginTop: Spacing.sm,
  },
  uploadBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: { flex: 1 },
  personName: { ...Typography.h4, marginBottom: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgText: { ...Typography.bodySmall },
  strengthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  strengthChipText: { fontSize: 12, fontWeight: '600' },

  section: { marginBottom: Spacing.sm },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, fontWeight: '500' },
  traitTag: {
    backgroundColor: Colors.badge,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  traitTagText: { fontSize: 12, color: Colors.badgeText, fontWeight: '500' },

  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  emojiText: { fontSize: 16 },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  relText: { ...Typography.bodySmall },
  descText: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginTop: 4 },
});
