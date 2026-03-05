// URL polyfill MUST be first — Supabase uses the URL API which Hermes doesn't implement
import 'react-native-url-polyfill/auto';
// react-native-gesture-handler must be the second import in the entry file
import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './src/lib/supabase';
import { Colors } from './src/theme';
import { RootStackParamList } from './src/navigation/types';

import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import UploadScreen from './src/screens/UploadScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import CommunicationMatrixScreen from './src/screens/CommunicationMatrixScreen';
import MyRelationshipsScreen from './src/screens/MyRelationshipsScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
            setSession(sess);
            setLoading(false);
        });

        // Get the current session on mount
        supabase.auth.getSession().then(({ data: { session: sess } }) => {
            setSession(sess);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <NavigationContainer>
                        <StatusBar style="dark" />
                        <Stack.Navigator
                            screenOptions={{
                                headerShown: false,
                                animation: 'slide_from_right',
                                contentStyle: { backgroundColor: Colors.background },
                            }}
                        >
                            {session ? (
                                // Authenticated screens
                                <>
                                    <Stack.Screen name="Dashboard" component={DashboardScreen} />
                                    <Stack.Screen name="Upload" component={UploadScreen} />
                                    <Stack.Screen name="Analysis" component={AnalysisScreen} />
                                    <Stack.Screen name="Matrix" component={CommunicationMatrixScreen} />
                                    <Stack.Screen name="MyRelationships" component={MyRelationshipsScreen} />
                                    <Stack.Screen name="Feedback" component={FeedbackScreen} />
                                </>
                            ) : (
                                // Unauthenticated
                                <Stack.Screen name="Auth" component={AuthScreen} />
                            )}
                        </Stack.Navigator>
                    </NavigationContainer>
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    loader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
    },
});
