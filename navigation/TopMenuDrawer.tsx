import React from 'react';
import { Alert, Animated, Pressable, StyleSheet, View } from 'react-native';
import {
  Portal,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import supabase from '../service/SupabaseClient';
import { traceAsync } from '../service/perfTrace';
import { trackEvent } from '../service/analyticsTracker';

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

const PANEL_HEIGHT = 375;

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
    (name: string, params?: any) => {
      closeMenu();
      navigationRef?.navigate?.(name, params);
    },
    [closeMenu, navigationRef],
  );

  const doLogout = React.useCallback(async () => {
    trackEvent('Auth_Logout_Clicked', { source: 'Menu' });
    try {
      await traceAsync('action_logout', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      });
      // AppNavigator listens to session changes and will redirect to AuthStack.
    } catch (e: any) {
      // no-op: keep UI stable
      console.warn('Logout failed', e?.message || e);
    }
  }, []);

  const confirmLogout = React.useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          closeMenu();
          void doLogout();
        },
      },
    ]);
  }, [closeMenu, doLogout]);

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
            <Animated.View
              style={[styles.panelWrap, { transform: [{ translateY }] }]}
            >
              <Surface
                style={[
                  styles.panel,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                    paddingTop: styles.panel.paddingTop + insets.top,
                  },
                ]}
                elevation={3}
              >
                <View
                  style={[
                    styles.handle,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />
                <Text
                  style={[styles.panelTitle, { color: theme.colors.onSurface }]}
                >
                  Menu
                </Text>

                <MenuItem
                  icon="account-circle-outline"
                  label="Profile"
                  onPress={() => go('MenuTabs', { screen: 'MenuProfile' })}
                />
                <MenuItem
                  icon="lock-reset"
                  label="Change password"
                  onPress={() =>
                    go('MenuTabs', { screen: 'MenuChangePassword' })
                  }
                />
                <MenuItem
                  icon="lifebuoy"
                  label="Support"
                  onPress={() => go('MenuTabs', { screen: 'MenuSupport' })}
                />
                <MenuItem
                  icon="information-outline"
                  label="About us"
                  onPress={() => go('MenuTabs', { screen: 'MenuAbout' })}
                />

                <View
                  style={[
                    styles.divider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />

                <MenuItem
                  icon="logout"
                  label="Logout"
                  onPress={confirmLogout}
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
  const iconColor =
    tone === 'danger' ? theme.colors.error : theme.colors.primary;
  const chevronColor =
    (theme.colors as any).onSurfaceVariant ?? theme.colors.onSurface;
  const itemBg =
    tone === 'danger' ? theme.colors.surface : theme.colors.surface;
  const itemBorder =
    (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const iconBg =
    tone === 'danger' ? theme.colors.surface : theme.colors.surface;

  return (
    <TouchableRipple
      onPress={onPress}
      style={[
        styles.item,
        { backgroundColor: itemBg, borderColor: itemBorder },
      ]}
    >
      <View style={styles.itemInner}>
        <View
          style={[
            styles.itemIconWrap,
            { backgroundColor: iconBg, borderColor: itemBorder },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>

        <Text style={[styles.itemText, { color }]} numberOfLines={1}>
          {label}
        </Text>

        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={chevronColor}
        />
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  panelWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  panel: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    opacity: 0.35,
    marginBottom: 8,
  },
  panelTitle: {
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'left',
  },
  item: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 12,
  },
  itemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, fontWeight: '800', fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
});
