import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Portal, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import supabase from '../service/SupabaseClient';

type NavRef = { navigate: (name: string, params?: any) => void } | null;

type Ctx = {
  openMenu: () => void;
  closeMenu: () => void;
};

const TopMenuContext = React.createContext<Ctx | null>(null);

export function useTopMenu() {
  const v = React.useContext(TopMenuContext);
  if (!v) throw new Error('useTopMenu must be used within TopMenuProvider');
  return v;
}

const PANEL_HEIGHT = 320;

export function TopMenuProvider({
  navigationRef,
  children,
}: {
  navigationRef: NavRef;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current; // 0 closed, 1 open

  const openMenu = React.useCallback(() => {
    setVisible(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const closeMenu = React.useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [anim]);

  const go = React.useCallback(
    (name: string) => {
      closeMenu();
      navigationRef?.navigate?.(name);
    },
    [closeMenu, navigationRef],
  );

  const doLogout = React.useCallback(async () => {
    closeMenu();
    try {
      await supabase.auth.signOut();
      // AppNavigator listens to session changes and will redirect to AuthStack.
    } catch (e: any) {
      // no-op: keep UI stable
      console.warn('Logout failed', e?.message || e);
    }
  }, [closeMenu]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-PANEL_HEIGHT, 0],
  });

  return (
    <TopMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}

      {visible ? (
        <Portal>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={closeMenu} />
            <Animated.View style={[styles.panelWrap, { transform: [{ translateY }] }]}>
              <Surface
                style={[
                  styles.panel,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline,
                    paddingTop: styles.panel.paddingTop + insets.top,
                  },
                ]}
                elevation={3}
              >
                <Text style={styles.panelTitle}>Menu</Text>

                <MenuItem icon="account-circle-outline" label="Profile" onPress={() => go('Profile')} />
                <MenuItem icon="lock-reset" label="Change password" onPress={() => go('ChangePassword')} />
                <MenuItem icon="lifebuoy" label="Support" onPress={() => go('Support')} />

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
                  ]}
                />

                <MenuItem
                  icon="logout"
                  label="Logout"
                  onPress={() => void doLogout()}
                  tone="danger"
                />
              </Surface>
            </Animated.View>
          </View>
        </Portal>
      ) : null}
    </TopMenuContext.Provider>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  tone?: 'danger';
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.colors.error : theme.colors.onSurface;
  const iconColor = tone === 'danger' ? theme.colors.error : theme.colors.primary;

  return (
    <TouchableRipple onPress={onPress} borderless style={styles.item}>
      <View style={styles.itemInner}>
        <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        <Text style={[styles.itemText, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.18)' },
  panelWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  panel: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  panelTitle: { fontWeight: '900', fontSize: 16, color: '#111827', marginBottom: 10 },
  item: { borderRadius: 14, overflow: 'hidden' },
  itemInner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  itemText: { fontWeight: '800', fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
});

