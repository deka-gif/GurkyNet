import { Redirect } from 'expo-router';

/**
 * Legacy full-screen PIN route for transfer — PIN now opens as PinConfirmModal
 * on /transfer/confirm. Keep file so deep links / back-stack don't 404.
 */
export default function TransferPinRedirect() {
  return <Redirect href="/transfer/confirm" />;
}
