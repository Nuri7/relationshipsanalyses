import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Star } from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FeedbackScreen() {
  const navigation = useNavigation<Nav>();
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      return Alert.alert('Missing feedback', 'Please write your feedback before submitting.');
    }
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        message: message.trim(),
        rating: rating || null,
      });

      if (error) throw error;

      Alert.alert('Thank you!', 'Your feedback has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Feedback</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Help us improve</Text>
            <Text style={styles.cardDesc}>Tell us what you love or what we can do better.</Text>

            {/* Star Rating */}
            <View style={styles.section}>
              <Text style={styles.label}>Rating (optional)</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(rating === star ? 0 : star)}
                    style={styles.starBtn}
                    activeOpacity={0.7}
                  >
                    <Star
                      size={32}
                      color={star <= rating ? '#F59E0B' : Colors.textLight}
                      fill={star <= rating ? '#F59E0B' : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Message */}
            <View style={styles.section}>
              <Text style={styles.label}>Your feedback</Text>
              <TextInput
                style={styles.textarea}
                value={message}
                onChangeText={setMessage}
                placeholder="What do you like? What could be better?"
                placeholderTextColor={Colors.textLight}
                multiline
                textAlignVertical="top"
                numberOfLines={6}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Your feedback helps us improve the app. We read every submission and use it to
              prioritize new features and fix issues.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },

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

  container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardTitle: { ...Typography.h3, marginBottom: Spacing.xs },
  cardDesc: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.xl },

  section: { marginBottom: Spacing.xl },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  stars: { flexDirection: 'row', gap: 4 },
  starBtn: { padding: 4 },

  textarea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    minHeight: 140,
    backgroundColor: '#FAFAFA',
  },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    ...Shadow.sm,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: { fontSize: 13, color: Colors.textMuted, lineHeight: 20, textAlign: 'center' },
});
