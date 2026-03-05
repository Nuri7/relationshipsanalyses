import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, MessageSquareText } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Typography, Shadow } from '../theme';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const showAlert = (title: string, message: string) =>
    Alert.alert(title, message);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      return showAlert('Missing fields', 'Please enter email and password.');
    }
    if (password.length < 6) {
      return showAlert('Password too short', 'Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        if (!displayName.trim()) {
          return showAlert('Missing name', 'Please enter your display name.');
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        showAlert('Check your email', 'We sent you a confirmation link.');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@example.com',
        password: 'demo1234',
      });
      if (error) throw error;
    } catch (err: any) {
      showAlert('Demo Login Failed', err.message || 'Demo account unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <MessageSquareText size={28} color="#FFF" />
            </View>
            <Text style={styles.appTitle}>Relationship Analyzer</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Sign in to analyze your chats' : 'Create an account to get started'}
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {!isLogin && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textLight}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isLogin ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Demo Login */}
            <TouchableOpacity
              style={[styles.outlineBtn, loading && styles.btnDisabled]}
              onPress={handleDemoLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Zap size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Quick Demo Login</Text>
            </TouchableOpacity>

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={styles.toggleLink}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },

  logoWrapper: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  appTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadow.md,
  },

  fieldGroup: { marginBottom: Spacing.lg },
  label: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    color: Colors.text,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#FAFAFA',
  },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { ...Typography.caption, color: Colors.textMuted },

  outlineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  outlineBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  toggleText: { ...Typography.bodySmall, color: Colors.textMuted },
  toggleLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
});
