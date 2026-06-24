import React, {useEffect, useMemo, useRef, useState} from 'react';
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
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GRID = 3;
const SIZE = GRID * GRID;

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
  }

  function handleTilePress(index: number) {
    const empty = board.indexOf(0);
    if (!canMove(empty, index)) return;
    const next = board.slice();
    next[empty] = next[index];
    next[index] = 0;
    const newMoves = moves + 1;
    setBoard(next);
    setMoves(newMoves);
    if (isSolved(next)) {
      // trigger win animation then show results
      triggerWinAnimation(newMoves, seconds);
    }
  }

  function triggerWinAnimation(finalMoves: number, finalSeconds: number) {
    // persist result immediately
    void saveRecord(finalMoves, finalSeconds);
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
      <Text style={styles.title}>Sliding Puzzle</Text>
      <Text style={styles.subtitle}>Slide tiles to order them — it's a brainy quick challenge.</Text>

      <View style={[styles.board, {width: boardSize, padding: boardPadding}]}> 
        {Array.from({length: GRID}).map((_, row) => (
          <View key={row} style={styles.row}>
            {Array.from({length: GRID}).map((__, col) => {
              const i = row * GRID + col;
              const val = board[i];
              const isLastCol = col === GRID - 1;
              const isLastRow = row === GRID - 1;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.8}
                  onPress={() => handleTilePress(i)}
                  style={[
                    styles.tile,
                    val === 0 && styles.empty,
                    {
                      width: tileSize,
                      height: tileSize,
                      marginRight: isLastCol ? 0 : tileGap,
                      marginBottom: isLastRow ? 0 : tileGap,
                    },
                  ]}>
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
        <Text style={styles.info}>Moves: {moves}</Text>
        <Text style={styles.info}>Time: {seconds}s</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={() => reset()}>
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
          }}>
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { loadRecords(); setRecordsVisible(true); }}>
          <Text style={styles.buttonText}>Records</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Tap tiles adjacent to the empty space to move them.</Text>

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
    backgroundColor: '#0f172a',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
    maxWidth: 420,
  },
  board: {
    borderRadius: 12,
    backgroundColor: '#0b1220',
  },
  row: {
    flexDirection: 'row',
  },
  tile: {
    margin: 0,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    backgroundColor: 'transparent',
  },
  tileText: {
    color: '#e6e6e6',
    fontSize: 28,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
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
    borderRadius: 10,
    backgroundColor: '#111827',
    marginHorizontal: 8,
  },
  primary: {
    backgroundColor: '#06b6d4',
  },
  buttonText: {
    color: '#e6e6e6',
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: '#061014',
  },
  footer: {
    color: '#94a3b8',
    marginTop: 18,
    fontSize: 13,
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
