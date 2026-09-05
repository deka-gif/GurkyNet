import { StyleSheet, View } from 'react-native';
import { ScreenContainer, ComingSoon } from '../../src/components/ui';

/**
 * Help tab placeholder — there is no dedicated Help/Support screen or backend
 * Help API in the mobile app yet (Akun menu lists "Bantuan" as Fase 8).
 * This tab only provides the required bottom-nav entry without inventing Help business logic.
 */
export default function HelpScreen() {
  return (
    <ScreenContainer scroll={false} padded={false}>
      <View style={styles.fill}>
        <ComingSoon icon="help-circle" title="Bantuan" phase="Fase 8" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
