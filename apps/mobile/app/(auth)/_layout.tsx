import { Stack } from 'expo-router';

/**
 * Auth stack — login / unlock / register / recovery / Google complete.
 * Success screens disable back gesture so users cannot return to PIN entry.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="unlock" />
      <Stack.Screen name="register" />
      <Stack.Screen name="register-otp" />
      <Stack.Screen name="register-pin" />
      <Stack.Screen
        name="register-success"
        options={{ gestureEnabled: false, headerBackVisible: false }}
      />
      <Stack.Screen name="setup-pin" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="google-complete" />
    </Stack>
  );
}
