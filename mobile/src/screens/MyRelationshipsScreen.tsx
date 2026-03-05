import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Users } from 'lucide-react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G } from 'react-native-svg';

import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ConnectionData {
  name: string;
  strength: number;
  type: string;
  description: string;
  userTone: string;
  userTraits: string[];
  userEmojis: string[];
  messageCount: number;
}

const ACCENT_COLORS = [
  '#7C3AED', '#059669', '#DC2626', '#D97706', '#2563EB', '#7E22CE',
];

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_SIZE = Math.min(SCREEN_W - Spacing.lg * 2, 340);

// Custom SVG Radar Chart
function RadarChart({ data }: { data: ConnectionData[] }) {
  if (!data.length) return null;
  const size = CHART_SIZE;
  const center = size / 2;
  const radius = size * 0.36;
  const n = data.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 10) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const getLabelPoint = (index: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = radius + 28;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  // Grid rings at 2, 4, 6, 8, 10
  const gridRings = [2, 4, 6, 8, 10];

  // Data polygon
  const dataPoints = data.map((d, i) => getPoint(i, d.strength));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';

  return (
    <Svg width={size} height={size}>
      {/* Grid rings */}
      {gridRings.map((v, i) => (
        <Circle
          key={i}
          cx={center}
          cy={center}
          r={(v / 10) * radius}
          fill="none"
          stroke={Colors.border}
          strokeWidth={1}
        />
      ))}

      {/* Axes */}
      {data.map((_, i) => {
        const p = getPoint(i, 10);
        return (
          <Line
            key={i}
            x1={center} y1={center}
            x2={p.x.toFixed(2)} y2={p.y.toFixed(2)}
            stroke={Colors.border}
            strokeWidth={1}
          />
        );
      })}

      {/* Filled data polygon */}
      <Path d={pathD} fill={Colors.primaryMedium} stroke={Colors.primary} strokeWidth={2} />

      {/* Data point circles */}
      {dataPoints.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={5} fill={Colors.primary} stroke="#FFF" strokeWidth={1.5} />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const lp = getLabelPoint(i);
        const label = d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name;
        return (
          <SvgText
            key={i}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={10}
            fontWeight="500"
            fill={Colors.text}
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export default function MyRelationshipsScreen() {
  const navigation = useNavigation<Nav>();
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConnectionData | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('id', user.id).single();
    const displayName = profile?.display_name || user.email?.split('@')[0] || '';
    setUserName(displayName);

    const { data: analyses } = await supabase.from('chat_analyses').select('*');
    if (!analyses || !displayName) { setLoading(false); return; }

    const lowerDisplay = displayName.toLowerCase();
    const connectionMap = new Map<string, ConnectionData>();

    for (const analysis of analyses) {
      const participants: string[] = Array.isArray(analysis.participants) ? analysis.participants as string[] : [];
      const chars: any[] = Array.isArray(analysis.characteristics) ? analysis.characteristics as any[] : [];
      const rels: any[] = Array.isArray(analysis.relationships) ? analysis.relationships as any[] : [];

      const userParticipant = participants.find(p => {
        const lp = p.toLowerCase();
        return lp.includes(lowerDisplay) || lowerDisplay.includes(lp);
      });
      if (!userParticipant) continue;

      const userChar = chars.find(c => c.name === userParticipant);

      for (const rel of rels) {
        const otherPerson =
          rel.person1 === userParticipant ? rel.person2 :
          rel.person2 === userParticipant ? rel.person1 : null;
        if (!otherPerson) continue;

        const existing = connectionMap.get(otherPerson);
        if (existing) {
          existing.strength = Math.max(existing.strength, rel.strength);
          if (userChar?.dominantTone && !existing.userTone) existing.userTone = userChar.dominantTone;
          if (userChar?.traits) existing.userTraits = [...new Set([...existing.userTraits, ...userChar.traits])];
          if (userChar?.topEmojis) existing.userEmojis = [...new Set([...existing.userEmojis, ...userChar.topEmojis])];
          existing.messageCount += userChar?.messageCount || 0;
        } else {
          connectionMap.set(otherPerson, {
            name: otherPerson,
            strength: rel.strength,
            type: rel.type,
            description: rel.description,
            userTone: userChar?.dominantTone || '',
            userTraits: userChar?.traits ? [...userChar.traits] : [],
            userEmojis: userChar?.topEmojis ? [...userChar.topEmojis] : [],
            messageCount: userChar?.messageCount || 0,
          });
        }
      }
    }

    const result = [...connectionMap.values()].sort((a, b) => b.strength - a.strength);
    setConnections(result);
    if (result.length > 0) setSelected(result[0]);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>My Relationships</Text>
          <Text style={styles.headerSub}>
            {userName ? `How ${userName} communicates` : 'Your communication web'}
          </Text>
        </View>
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
        ) : connections.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptyDesc}>
              We couldn't match your profile name to any chat participants. Make sure your display name
              matches how you appear in your WhatsApp chats.
            </Text>
            <Text style={styles.nameHint}>
              Current name:{' '}
              <Text style={{ color: Colors.text, fontWeight: '600' }}>{userName || 'Not set'}</Text>
            </Text>
          </View>
        ) : (
          <>
            {/* Radar chart card */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Relationship Web</Text>
              <Text style={styles.chartDesc}>Connection strength with each person (out of 10)</Text>
              <View style={styles.chartWrap}>
                <RadarChart data={connections} />
              </View>
            </View>

            {/* Connection list */}
            {connections.map((conn, i) => (
              <TouchableOpacity
                key={conn.name}
                style={[styles.connCard, selected?.name === conn.name && styles.connCardActive]}
                onPress={() => setSelected(selected?.name === conn.name ? null : conn)}
                activeOpacity={0.85}
              >
                <View style={styles.connHeader}>
                  <View style={styles.connLeft}>
                    <View style={[styles.colorDot, { backgroundColor: ACCENT_COLORS[i % ACCENT_COLORS.length] }]} />
                    <Text style={styles.connName}>{conn.name}</Text>
                  </View>
                  <View style={[styles.typeBadge]}>
                    <Text style={styles.typeText}>{conn.type}</Text>
                  </View>
                </View>

                {/* Strength bar */}
                <View style={styles.barRow}>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${(conn.strength / 10) * 100}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{conn.strength}/10</Text>
                </View>

                {/* Expanded detail */}
                {selected?.name === conn.name && (
                  <View style={styles.detail}>
                    {conn.userTone ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>YOUR TONE</Text>
                        <View style={[styles.toneBadge]}>
                          <Text style={styles.toneText}>{conn.userTone}</Text>
                        </View>
                      </View>
                    ) : null}

                    {conn.userTraits.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>YOUR TRAITS</Text>
                        <View style={styles.traitRow}>
                          {conn.userTraits.slice(0, 5).map((t, j) => (
                            <View key={j} style={styles.traitBadge}>
                              <Text style={styles.traitText}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {conn.userEmojis.length > 0 && (
                      <Text style={styles.emojiLine}>{conn.userEmojis.slice(0, 5).join(' ')}</Text>
                    )}

                    <Text style={styles.connDesc} numberOfLines={3}>{conn.description}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
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
    gap: Spacing.md,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted },

  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
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
  nameHint: { ...Typography.bodySmall, color: Colors.textMuted },

  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadow.sm,
  },
  chartTitle: { ...Typography.h4, alignSelf: 'flex-start' },
  chartDesc: { ...Typography.bodySmall, alignSelf: 'flex-start', marginBottom: Spacing.md },
  chartWrap: { alignItems: 'center' },

  connCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  connCardActive: {
    borderColor: Colors.primary,
    ...Shadow.md,
  },
  connHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  connLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  connName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeText: { fontSize: 11, color: Colors.textMuted },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  barBg: { flex: 1, height: 6, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  barLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, minWidth: 36 },

  detail: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    gap: Spacing.sm,
  },
  detailSection: { gap: 6 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  toneBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toneText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  traitBadge: {
    backgroundColor: Colors.badge,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  traitText: { fontSize: 11, color: Colors.badgeText, fontWeight: '500' },
  emojiLine: { fontSize: 15 },
  connDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
});
