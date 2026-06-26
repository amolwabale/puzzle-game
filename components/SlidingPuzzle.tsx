import React, {useEffect, useMemo, useRef, useState} from 'react';
import {trackEvent} from '../service/analyticsTracker';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  Animated,
  Easing,
  Modal,
  FlatList,
  NativeModules,
  Platform,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GRID = 3;
const SIZE = GRID * GRID;
type TileStrobeKind = 'success' | 'error';

const tileColors = [
  '#22d3ee',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#60a5fa',
  '#fb7185',
  '#c084fc',
];

const TileSound = NativeModules.TileSound as
  | {
      playTileShuffleSound?: () => void;
      playTileErrorSound?: () => void;
      playGameStartSound?: () => void;
      playGameWinSound?: () => void;
    }
  | undefined;

function playTileShuffleSound() {
  if (Platform.OS !== 'android') return;

  try {
    TileSound?.playTileShuffleSound?.();
  } catch (e) {
    // Sound should never interrupt gameplay.
  }
}

function playTileErrorSound() {
  if (Platform.OS !== 'android') return;

  try {
    TileSound?.playTileErrorSound?.();
  } catch (e) {
    // Sound should never interrupt gameplay.
  }
}

function playGameStartSound() {
  if (Platform.OS !== 'android') return;

  try {
    TileSound?.playGameStartSound?.();
  } catch (e) {
    // Sound should never interrupt gameplay.
  }
}

function playGameWinSound() {
  if (Platform.OS !== 'android') return;

  try {
    TileSound?.playGameWinSound?.();
  } catch (e) {
    // Sound should never interrupt gameplay.
  }
}

function idxToPos(index: number) {
  return {row: Math.floor(index / GRID), col: index % GRID};
}

function canMove(emptyIndex: number, tileIndex: number) {
  const e = idxToPos(emptyIndex);
  const t = idxToPos(tileIndex);
  return (
    (e.row === t.row && Math.abs(e.col - t.col) === 1) ||
    (e.col === t.col && Math.abs(e.row - t.row) === 1)
  );
}

function makeSolved() {
  return Array.from({length: SIZE}, (_, i) => (i === SIZE - 1 ? 0 : i + 1));
}

export default function SlidingPuzzle() {
  const solved = useMemo(makeSolved, []);
  const [board, setBoard] = useState<number[]>(solved);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [showWin, setShowWin] = useState(false);
  const starAnims = useRef(Array.from({length: 3}, () => new Animated.Value(0))).current;
  const tileStrobeAnims = useRef(Array.from({length: SIZE}, () => new Animated.Value(0))).current;
  const [tileStrobeColors, setTileStrobeColors] = useState<Record<number, string>>({});
  const [records, setRecords] = useState<Array<{moves:number;seconds:number;at:string}>>([]);
  const [recordsVisible, setRecordsVisible] = useState(false);
  const {width: windowWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive board sizing
  const boardPadding = 6; // inside padding
  const tileGap = 6; // gap between tiles
  const maxBoard = Math.min(420, windowWidth - 40);
  const boardSize = Math.max(240, maxBoard);
  const tileSize = Math.floor(
    (boardSize - boardPadding * 2 - (GRID - 1) * tileGap) / GRID,
  );

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Hide native boot splash if available (prevents hanging on native splash)
    try {
      BootSplash?.hide?.({fade: true});
    } catch (e) {
      // ignore if bootsplash not configured
    }
    playGameStartSound();
  }, []);

  useEffect(() => {
    // shuffle by making N random legal moves from solved
    const steps = 60;
    let b = solved.slice();
    let empty = b.indexOf(0);
    for (let i = 0; i < steps; i++) {
      const neighbors = [] as number[];
      for (let j = 0; j < SIZE; j++) if (canMove(empty, j)) neighbors.push(j);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      const tmp = b[pick];
      b[pick] = 0;
      b[empty] = tmp;
      empty = pick;
    }
    setBoard(b);
    setMoves(0);
    setSeconds(0);
  }, [solved]);

  function reset() {
    setBoard(solved.slice());
    setMoves(0);
    setSeconds(0);
    playGameStartSound();
    try { void trackEvent('game_reset'); } catch {}
  }

  function triggerTileStrobe(index: number, kind: TileStrobeKind) {
    const anim = tileStrobeAnims[index];
    const color =
      kind === 'success'
        ? 'rgba(34, 197, 94, 0.82)'
        : 'rgba(248, 113, 113, 0.86)';

    setTileStrobeColors(colors => ({...colors, [index]: color}));
    anim.stopAnimation();
    anim.setValue(0);

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0.28,
        duration: 55,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0.78,
        duration: 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: kind === 'success' ? 170 : 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTileStrobeColors(colors => {
        const next = {...colors};
        delete next[index];
        return next;
      });
    });
  }

  function handleTilePress(index: number) {
    const empty = board.indexOf(0);
    if (!canMove(empty, index)) {
      triggerTileStrobe(index, 'error');
      playTileErrorSound();
      return;
    }
    const next = board.slice();
    next[empty] = next[index];
    next[index] = 0;
    const newMoves = moves + 1;
    setBoard(next);
    setMoves(newMoves);
    triggerTileStrobe(empty, 'success');
    playTileShuffleSound();
    try {
      const movedValue = next[empty];
      void trackEvent('tile_click', {tile: movedValue, moves: newMoves});
    } catch (e) {
      // ignore analytics failure
    }
    if (isSolved(next)) {
      // trigger win animation then show results
      triggerWinAnimation(newMoves, seconds);
    }
  }

  function triggerWinAnimation(finalMoves: number, finalSeconds: number) {
    // persist result immediately
    void saveRecord(finalMoves, finalSeconds);
    try {
      void trackEvent('game_win', {moves: finalMoves, seconds: finalSeconds});
    } catch (e) {
      // ignore
    }
    playGameWinSound();
    setShowWin(true);
    // reset anim values
    starAnims.forEach(a => a.setValue(0));
    const anims = starAnims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        useNativeDriver: true,
        duration: 450,
        delay: i * 180,
        easing: Easing.out(Easing.back(1.2)),
      }),
    );
    Animated.stagger(120, anims).start(() => {
      // after animation, show results then hide overlay
      setTimeout(() => {
        Alert.alert('Nice!', `You solved it in ${finalMoves} moves and ${finalSeconds} seconds.`);
        setShowWin(false);
      }, 500);
    });
  }

  const RECORDS_KEY = '@puzzle_records';

  async function loadRecords() {
    try {
      const raw = await AsyncStorage.getItem(RECORDS_KEY);
      if (!raw) return setRecords([]);
      const parsed = JSON.parse(raw) as Array<{moves:number;seconds:number;at:string}>;
      setRecords(parsed || []);
    } catch (e) {
      // ignore
    }
  }

  async function saveRecord(movesNum: number, secondsNum: number) {
    try {
      const rec = {moves: movesNum, seconds: secondsNum, at: new Date().toISOString()};
      const next = [rec, ...(records || [])].slice(0, 50);
      await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(next));
      setRecords(next);
    } catch (e) {
      // ignore
    }
  }

  // clearRecords and deleteRecord removed — records are stored locally but not deletable from UI

  function isSolved(b: number[]) {
    for (let i = 0; i < SIZE; i++) {
      if (b[i] !== solved[i]) return false;
    }
    return true;
  }

  return (
    <SafeAreaView style={[styles.container, {paddingTop: Math.max(12, insets.top)}]}>
      <View pointerEvents="none" style={styles.bgBubbleOne} />
      <View pointerEvents="none" style={styles.bgBubbleTwo} />
      <View pointerEvents="none" style={styles.bgBubbleThree} />

      <View style={styles.heroBadge}>
        <Text style={styles.heroBadgeText}>🧠 Brainy Fun</Text>
      </View>
      <Text style={styles.title}>Sliding Puzzle</Text>
      <Text style={styles.subtitle}>Slide • Think • Win — a colorful puzzle challenge for curious minds.</Text>

      <View style={[styles.board, {width: boardSize, padding: boardPadding}]}> 
        {Array.from({length: GRID}).map((_, row) => (
          <View key={row} style={styles.row}>
            {Array.from({length: GRID}).map((__, col) => {
              const i = row * GRID + col;
              const val = board[i];
              const isLastCol = col === GRID - 1;
              const isLastRow = row === GRID - 1;
              const strobeColor = tileStrobeColors[i];
              const strobeScale = tileStrobeAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0.88, 1.08],
              });
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.8}
                  onPress={() => handleTilePress(i)}
                  style={[
                    styles.tile,
                    val === 0 && styles.empty,
                    val !== 0 && {
                      backgroundColor: tileColors[(val - 1) % tileColors.length],
                    },
                    {
                      width: tileSize,
                      height: tileSize,
                      marginRight: isLastCol ? 0 : tileGap,
                      marginBottom: isLastRow ? 0 : tileGap,
                    },
                  ]}>
                  {strobeColor ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.tileStrobe,
                        {
                          backgroundColor: strobeColor,
                          borderColor: strobeColor,
                          opacity: tileStrobeAnims[i],
                          transform: [{scale: strobeScale}],
                        },
                      ]}
                    />
                  ) : null}
                  {val !== 0 ? (
                    <Text style={[styles.tileText, {fontSize: Math.max(18, Math.round(tileSize * 0.36))}]}> 
                      {val}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.infoRow}>
        <View style={styles.scorePill}>
          <Text style={styles.scoreLabel}>Moves</Text>
          <Text style={styles.scoreValue}>{moves}</Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={styles.scoreLabel}>Time</Text>
          <Text style={styles.scoreValue}>{seconds}s</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={() => reset()}>
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primary]}
          onPress={() => {
            // reshuffle
            const steps = 60;
            let b = solved.slice();
            let empty = b.indexOf(0);
            for (let i = 0; i < steps; i++) {
              const neighbors = [] as number[];
              for (let j = 0; j < SIZE; j++) if (canMove(empty, j)) neighbors.push(j);
              const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
              const tmp = b[pick];
              b[pick] = 0;
              b[empty] = tmp;
              empty = pick;
            }
            setBoard(b);
            setMoves(0);
            setSeconds(0);
            playTileShuffleSound();
            try { void trackEvent('shuffle'); } catch {}
          }}>
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.recordsButton]}
          onPress={() => { loadRecords(); setRecordsVisible(true); try { void trackEvent('records_open'); } catch {} }}>
          <Text style={styles.buttonText}>Records</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>✨ Tap a tile next to the empty space and make the board sparkle!</Text>

      <Modal visible={showWin} transparent animationType="fade">
        <View style={styles.winOverlay} pointerEvents="none">
          <View style={styles.winInner}>
            {starAnims.map((anim, i) => {
              const scale = anim.interpolate({inputRange: [0, 1], outputRange: [0.3, 1.15]});
              const opacity = anim;
              return (
                <Animated.Text
                  key={i}
                  style={[styles.star, {transform: [{scale}], opacity, marginLeft: i === 0 ? 0 : 12}]}>
                  ★
                </Animated.Text>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={recordsVisible} animationType="slide" onRequestClose={() => setRecordsVisible(false)}>
        <SafeAreaView style={[styles.container, {paddingTop: Math.max(12, insets.top)}]}>
          <Text style={styles.title}>Records</Text>
          <FlatList
            data={records}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{padding: 12}}
                    renderItem={({item}) => (
                      <View style={styles.recordRow}>
                        <View>
                          <Text style={styles.info}>Moves: {item.moves} — Time: {item.seconds}s</Text>
                          <Text style={styles.subtitle}>{new Date(item.at).toLocaleString()}</Text>
                        </View>
                      </View>
                    )}
            ListEmptyComponent={<Text style={styles.subtitle}>No records yet</Text>}
          />

          <View style={[styles.controls, {marginTop: 12}]}> 
            <TouchableOpacity style={styles.button} onPress={() => setRecordsVisible(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0ea5e9',
    overflow: 'hidden',
  },
  bgBubbleOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(250, 204, 21, 0.42)',
    top: -90,
    left: -70,
  },
  bgBubbleTwo: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: 'rgba(167, 139, 250, 0.34)',
    right: -110,
    top: 90,
  },
  bgBubbleThree: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(52, 211, 153, 0.28)',
    bottom: -80,
    left: 26,
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    shadowColor: '#075985',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  heroBadgeText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(7, 89, 133, 0.45)',
    textShadowOffset: {width: 0, height: 3},
    textShadowRadius: 8,
  },
  subtitle: {
    color: '#ecfeff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 21,
    textShadowColor: 'rgba(8, 47, 73, 0.26)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  board: {
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#075985',
    shadowOffset: {width: 0, height: 14},
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
  },
  tile: {
    margin: 0,
    backgroundColor: '#22d3ee',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 4,
  },
  empty: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  tileText: {
    color: '#102033',
    fontSize: 28,
    fontWeight: '900',
    zIndex: 2,
    textShadowColor: 'rgba(255, 255, 255, 0.45)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  tileStrobe: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 2,
    shadowColor: '#ffffff',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  scorePill: {
    minWidth: 112,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.93)',
    shadowColor: '#075985',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  scoreLabel: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scoreValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 1,
  },
  info: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  controls: {
    flexDirection: 'row',
    marginTop: 18,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#f97316',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  primary: {
    backgroundColor: '#facc15',
  },
  resetButton: {
    backgroundColor: '#fb7185',
  },
  recordsButton: {
    backgroundColor: '#8b5cf6',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '900',
    textShadowColor: 'rgba(15, 23, 42, 0.22)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  buttonTextPrimary: {
    color: '#2b2100',
    textShadowColor: 'rgba(255, 255, 255, 0.32)',
  },
  footer: {
    color: '#f0f9ff',
    marginTop: 18,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 380,
    textShadowColor: 'rgba(8, 47, 73, 0.28)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  winOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winInner: {
    padding: 28,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    fontSize: 56,
    color: '#ffd166',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#081226',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  // smallBtn removed
  // debugButton removed
});
