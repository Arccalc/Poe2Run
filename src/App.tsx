import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface FsmSplit {
  zone_name: string;
  ref_elapsed_ms: number;
  ref_duration_ms: number;
  actual_elapsed_ms: number | null;
  actual_duration_ms: number | null;
  delta_ms: number | null;
  visit_number: number | null;
}

interface FsmStatePayload {
  mode: 'Idle' | 'ShadowRecord' | 'Speedrun';
  total_elapsed_ms: number;
  total_town_time_ms: number;
  is_in_town: boolean;
  current_zone: string;
  current_split_index: number;
  current_split_name: string;
  delta_ms: number;
  route_splits: FsmSplit[];
  is_paused: boolean;
}


const ZONE_ACT_MAPPING: Record<string, string> = {
  // Act 1
  'The Riverbank': 'ACT 1',
  'Clearfell Encampment': 'ACT 1',
  'Clearfell': 'ACT 1',
  'The Grelwood': 'ACT 1',
  'The Red Vale': 'ACT 1',
  'The Grim Tangle': 'ACT 1',
  'Cemetery of the Eternals': 'ACT 1',
  'Freythorn': 'ACT 1',
  'Mausoleum of the Praetor': 'ACT 1',
  'The Hunting Grounds': 'ACT 1',
  'Hunting Grounds': 'ACT 1',
  'Ogham Village': 'ACT 1',
  'Ogham Manor': 'ACT 1',
  'Ogham Farmlands': 'ACT 1',
  'The Manor Ramparts': 'ACT 1',
  'Tomb of the Consort': 'ACT 1',
  'The Mud Burrow': 'ACT 1',
  'Mud Burrow': 'ACT 1',
  // Act 2
  'Vastiri Outskirts': 'ACT 2',
  'Ardura Caravan': 'ACT 2',
  'The Ardura Caravan': 'ACT 2',
  'The Arduran Caravan': 'ACT 2',
  'Deshar': 'ACT 2',
  'Arduran Caravan': 'ACT 2',
  'Mawdun Quarry': 'ACT 2',
  'Mawdun Mine': 'ACT 2',
  'The Halani Gates': 'ACT 2',
  'Halani Gates': 'ACT 2',
  'Traitor\'s Passage': 'ACT 2',
  'Traitors Passage': 'ACT 2',
  'Keth': 'ACT 2',
  'The Lost City': 'ACT 2',
  'Lost City': 'ACT 2',
  'The Heart of Keth': 'ACT 2',
  'Heart of Keth': 'ACT 2',
  'Valley of the Titans': 'ACT 2',
  'The Mastodon Badlands': 'ACT 2',
  'Mastodon Badlands': 'ACT 2',
  'The Bone Pits': 'ACT 2',
  'Bone Pits': 'ACT 2',
  'Path of Mourning': 'ACT 2',
  'The Dreadnought': 'ACT 2',
  'Dreadnought': 'ACT 2',
  'Dreadnought Vanguard': 'ACT 2',
  'The Spires of Deshar': 'ACT 2',
  'Spires of Deshar': 'ACT 2',
  'The Titan Grotto': 'ACT 2',
  'Titan Grotto': 'ACT 2',
  // Act 3
  'Sandswept Marsh': 'ACT 3',
  'Sandswept March': 'ACT 3',
  'Ziggurat Encampment': 'ACT 3',
  'Ziggurat': 'ACT 3',
  'Jungle Ruins': 'ACT 3',
  'The Venom Crypts': 'ACT 3',
  'Venom Crypts': 'ACT 3',
  'Infested Barrens': 'ACT 3',
  'The Azak Bog': 'ACT 3',
  'Azak Bog': 'ACT 3',
  'Chimeral Wetlands': 'ACT 3',
  'Jiquani\'s Machinarium': 'ACT 3',
  'Jiquanis Machinarium': 'ACT 3',
  'Jiquani\'s Sanctum': 'ACT 3',
  'Jiquanis Sanctum': 'ACT 3',
  'The Matlan Waterways': 'ACT 3',
  'Matlan Waterways': 'ACT 3',
  'The Drowned City': 'ACT 3',
  'Drowned City': 'ACT 3',
  'The Molten Vault': 'ACT 3',
  'Molten Vault': 'ACT 3',
  'Apex of Filth': 'ACT 3',
  'Temple of Kopec': 'ACT 3',
  'Utzaal': 'ACT 3',
  'Aggorat': 'ACT 3',
  'The Black Chambers': 'ACT 3',
  'Black Chambers': 'ACT 3',
  // Act 4
  'Kingsmarch': 'ACT 4',
  'Kedge Bay': 'ACT 4',
  'Isle of Kin': 'ACT 4',
  'Volcanic Warrens': 'ACT 4',
  'Whakapanu Island': 'ACT 4',
  'Singing Caverns': 'ACT 4',
  'Abandoned Prison': 'ACT 4',
  'Solitary Confinement': 'ACT 4',
  'Shrike Island': 'ACT 4',
  'Eye of Hinekora': 'ACT 4',
  'Halls of the Dead': 'ACT 4',
  "Journey's End": 'ACT 4',
  'Ngakanu': 'ACT 4',
  'Arastas': 'ACT 4',
  // Interlude 1 (Curse of Holten)
  'The Refuge': 'INTERLUDE 1',
  'Scorched Farmlands': 'INTERLUDE 1',
  'Stones of Serle': 'INTERLUDE 1',
  'The Blackwood': 'INTERLUDE 1',
  'Holten': 'INTERLUDE 1',
  'Wolvenhold': 'INTERLUDE 1',
  'Holten Estate': 'INTERLUDE 1',
  // Interlude 2 (Stolen Barya)
  'The Khari Bazaar': 'INTERLUDE 2',
  'The Khari Crossing': 'INTERLUDE 2',
  'Khari Crossing': 'INTERLUDE 2',
  'Pools of Khatal': 'INTERLUDE 2',
  'Sel Khari Sanctuary': 'INTERLUDE 2',
  'Vastiri': 'INTERLUDE 2',
  // Interlude 3 (Doryani's Contingency)
  'The Glade': 'INTERLUDE 3',
  'Mount Kriar': 'INTERLUDE 3',
  'Ashen Forest': 'INTERLUDE 3',
  'Kriar Village': 'INTERLUDE 3',
  'Glacial Tarn': 'INTERLUDE 3',
  'Howling Caves': 'INTERLUDE 3',
  'Kriar Peaks': 'INTERLUDE 3',
  'Etched Ravine': 'INTERLUDE 3',
  'The Cuachic Vault': 'INTERLUDE 3',
  'Cuachic Vault': 'INTERLUDE 3',
};

const getActForZone = (zoneName: string): string => {
  const normalized = zoneName.trim().toLowerCase();
  for (const [key, value] of Object.entries(ZONE_ACT_MAPPING)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  return '';
};


const ACT_TRIGGER_ZONES = [
  'the riverbank',
  'vastiri outskirts',
  'sandswept marsh',
  'sandswept march',
  'kingsmarch',
  'the refuge',
  'the khari bazaar',
  'the glade'
];

const isActTriggerZone = (zoneName: string): boolean => {
  return ACT_TRIGGER_ZONES.includes(zoneName.trim().toLowerCase());
};

type SplitGroup = {
  actName: string;
  splits: (FsmSplit & { originalIndex: number })[];
  isActive: boolean;
  isCompleted: boolean;
  totalActTimeMs: number;
  totalRefTimeMs: number;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'timer' | 'analytics' | 'settings'>('timer');
  const [expandedActs, setExpandedActs] = useState<Record<string, boolean>>({});
  const [clientPath, setClientPath] = useState<string>(() => {
    return localStorage.getItem('poe_client_path') || '';
  });
  const [routePath, setRoutePath] = useState<string>(() => {
    return localStorage.getItem('poe_route_path') || '';
  });
  const [isPathConfigured, setIsPathConfigured] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(() => {
    return localStorage.getItem('is_always_on_top') === 'true';
  });
  
  // Добавляем сохранение стейта Muling
  const [isMuling, setIsMuling] = useState<boolean>(() => {
    return localStorage.getItem('poe_is_muling') === 'true';
  });

  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('window_opacity');
    return saved ? parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    invoke('set_always_on_top', { alwaysOnTop: isAlwaysOnTop })
      .catch((e) => console.error('Failed to set always on top:', e));
    localStorage.setItem('is_always_on_top', isAlwaysOnTop.toString());
  }, [isAlwaysOnTop]);

  useEffect(() => {
    localStorage.setItem('window_opacity', opacity.toString());
  }, [opacity]);

  useEffect(() => {
    localStorage.setItem('poe_is_muling', isMuling.toString());
  }, [isMuling]);

  const [justTimer, setJustTimer] = useState<boolean>(() => {
    return localStorage.getItem('just_timer') === 'true';
  });
  const dragTimeoutRef = useRef<any>(null);
  
  useEffect(() => {
    let unlistenMode: any;
    let unlistenPin: any;

    const setupListeners = async () => {
      try {
        unlistenMode = await listen('menu-toggle-mode', () => {
          setJustTimer((prev) => !prev);
        });
        unlistenPin = await listen('menu-toggle-pin', () => {
          setIsAlwaysOnTop((prev) => !prev);
        });
      } catch (e) {
        console.error('Failed to setup menu listeners:', e);
      }
    };

    setupListeners();

    return () => {
      if (unlistenMode) unlistenMode();
      if (unlistenPin) unlistenPin();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('just_timer', justTimer.toString());
  }, [justTimer]);

  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  const [fsmState, setFsmState] = useState<FsmStatePayload>({
    mode: 'Idle',
    total_elapsed_ms: 0,
    total_town_time_ms: 0,
    is_in_town: false,
    current_zone: 'Unknown',
    current_split_index: 0,
    current_split_name: '',
    delta_ms: 0,
    route_splits: [],
    is_paused: false,
  });

  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showResumeModal, setShowResumeModal] = useState<boolean>(false);
  const [pendingResumePath, setPendingResumePath] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const isEditModeRef = useRef<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const activeSplitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeSplitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [fsmState.current_split_index]);

  // Sync isEditMode to a ref to avoid stale closures in event handlers
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditModeRef.current) return;
    draggedIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Defer DOM updates to prevent Chromium from immediately aborting drag
    setTimeout(() => {
      setDraggedIndex(index);
    }, 0);
  };

  const getActForSplit = (index: number): string => {
    if (index < 0 || index >= fsmState.route_splits.length) return 'PROLOGUE';
    const zone = fsmState.route_splits[index].zone_name;
    let act = getActForZone(zone);
    if (act) return act;
    
    for (let i = index - 1; i >= 0; i--) {
      act = getActForZone(fsmState.route_splits[i].zone_name);
      if (act) return act;
    }
    for (let i = index + 1; i < fsmState.route_splits.length; i++) {
      act = getActForZone(fsmState.route_splits[i].zone_name);
      if (act) return act;
    }
    return 'PROLOGUE';
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditModeRef.current) return;
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    if (sourceIndex !== null) {
      const draggedAct = getActForSplit(sourceIndex);
      const targetAct = getActForSplit(targetIndex);
      if (draggedAct === targetAct) {
        e.dataTransfer.dropEffect = 'move';
        return;
      }
    }
    e.dataTransfer.dropEffect = 'none';
  };

  const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditModeRef.current) return;
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    if (sourceIndex !== null) {
      const draggedAct = getActForSplit(sourceIndex);
      const targetAct = getActForSplit(targetIndex);
      if (draggedAct === targetAct) {
        e.dataTransfer.dropEffect = 'move';
        return;
      }
    }
    e.dataTransfer.dropEffect = 'none';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    if (!isEditModeRef.current) return;
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    const draggedAct = getActForSplit(sourceIndex);
    const targetAct = getActForSplit(targetIndex);
    if (draggedAct !== targetAct) return;

    const indices = Array.from({ length: fsmState.route_splits.length }, (_, i) => i);
    indices.splice(sourceIndex, 1);
    indices.splice(targetIndex, 0, sourceIndex);

    try {
      setErrorMsg('');
      await invoke('reorder_route_splits', { newIndices: indices });
    } catch (err: any) {
      setErrorMsg(`Failed to reorder splits: ${err.toString()}`);
    }
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
  };


  const isLong = fsmState.total_elapsed_ms >= 3600000;
  useEffect(() => {
    const applyWindowChanges = async () => {
      try {
        if (justTimer) {
          setActiveTab('timer');
          const width = isLong ? 200.0 : 160.0;
          await invoke('set_window_size', { width, height: 40.0 });
        } else {
          await invoke('set_window_size', { width: 360.0, height: 650.0 });
        }
      } catch (err) {
        console.error('Failed to change window size:', err);
      }
    };
    applyWindowChanges();
  }, [justTimer, isLong]);

  const formatTime = (ms: number): string => {
    const sign = ms < 0 ? '-' : '';
    const absoluteMs = Math.abs(ms);
    const hours = Math.floor(absoluteMs / 3600000);
    const minutes = Math.floor((absoluteMs % 3600000) / 60000);
    const seconds = Math.floor((absoluteMs % 60000) / 1000);
    const centiseconds = Math.floor((absoluteMs % 1000) / 10);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${sign}${hours}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
    }
    return `${sign}${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
  };

  const formatDelta = (ms: number): string => {
    if (ms === 0) return '±0.00s';
    const sign = ms > 0 ? '+' : '';
    const seconds = (ms / 1000).toFixed(2);
    return `${sign}${seconds}s`;
  };

  useEffect(() => {
    invoke<FsmStatePayload>('get_state')
      .then((state) => setFsmState(state))
      .catch((err) => console.error('Failed to get initial state:', err));

    const unlistenPromise = listen<FsmStatePayload>('fsm-state-update', (event) => {
      setFsmState(event.payload);
    });

    if (clientPath) {
      initializeClientPath(clientPath);
    }

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const initializeClientPath = async (path: string) => {
    if (!path.trim()) return;
    try {
      setErrorMsg('');
      const response = await invoke<string>('set_client_path', { path });
      setSuccessMsg(response);
      localStorage.setItem('poe_client_path', path);
      setIsPathConfigured(true);
    } catch (err: any) {
      setErrorMsg(err.toString());
      setIsPathConfigured(false);
    }
  };

  const handleStartRun = async (mode: 'ShadowRecord' | 'Speedrun', resume: boolean = false) => {
    if (!isPathConfigured) {
      setErrorMsg('Please configure a valid Client.txt path first.');
      return;
    }
    try {
      setErrorMsg('');
      setSuccessMsg('');
      
      let pathArg = null;
      if (mode === 'Speedrun' || (mode === 'ShadowRecord' && resume)) {
        const selectedFile = await invoke<string | null>('select_route_file');
        if (!selectedFile) return;
        pathArg = selectedFile;
        setRoutePath(selectedFile);
        localStorage.setItem('poe_route_path', selectedFile);
      }
      
      // Передаем isMuling на бэкенд
      await invoke<string>('start_run', { mode, routeJsonPath: pathArg, resume, muling: isMuling });
      setSuccessMsg(`Started run in ${mode} mode${resume ? ' (resumed route)' : ''}.`);
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleStopRun = async () => {
    try {
      setErrorMsg('');
      const res = await invoke<string>('stop_run');
      if (res && res !== 'Run stopped') {
        setSuccessMsg(`Run stopped and route auto-saved to folder: ${res}`);
        setRoutePath(res);
        localStorage.setItem('poe_route_path', res);
      } else {
        setSuccessMsg('Run stopped.');
      }
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleResetRun = async () => {
    const hasCompletedSplits = fsmState.mode === 'Speedrun' 
      ? fsmState.current_split_index > 0 
      : (fsmState.mode === 'ShadowRecord' && fsmState.route_splits.length > 0);

    if (hasCompletedSplits) {
      setShowResetConfirm(true);
    } else {
      await performReset(false);
    }
  };

  const performReset = async (shouldOverwrite: boolean) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setShowResetConfirm(false);
      
      if (shouldOverwrite) {
        try {
          const res = await invoke<string>('overwrite_route_splits');
          setSuccessMsg(res);
        } catch (e: any) {
          setErrorMsg(`Failed to overwrite splits: ${e.toString()}`);
        }
      }
      
      await invoke<string>('reset_run');
      if (!shouldOverwrite) {
        setSuccessMsg('Run reset successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const handleResumeClick = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const selected = await invoke<string | null>('select_route_file');
      if (!selected) return;
      setPendingResumePath(selected);
      setShowResumeModal(true);
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  };

  const performResume = async (mode: 'ShadowRecord' | 'Speedrun') => {
    if (!pendingResumePath) return;
    try {
      setShowResumeModal(false);
      setRoutePath(pendingResumePath);
      localStorage.setItem('poe_route_path', pendingResumePath);
      
      await invoke<string>('start_run', { 
        mode, 
        routeJsonPath: pendingResumePath, 
        resume: true, 
        muling: isMuling 
      });
      setSuccessMsg(`Resumed route in ${mode === 'Speedrun' ? 'Speedrun' : 'Blind Run'} mode.`);
      setPendingResumePath(null);
    } catch (err: any) {
      setErrorMsg(err.toString());
      setPendingResumePath(null);
    }
  };

  const groupedSplitsMap = new Map<string, SplitGroup>();

  fsmState.route_splits.forEach((split, index) => {
    const actName = getActForSplit(index);
    if (!groupedSplitsMap.has(actName)) {
      groupedSplitsMap.set(actName, {
        actName,
        splits: [],
        isActive: false,
        isCompleted: true,
        totalActTimeMs: 0,
        totalRefTimeMs: 0,
      });
    }

    const group = groupedSplitsMap.get(actName)!;
    group.splits.push({ ...split, originalIndex: index });

    if (index === fsmState.current_split_index) {
      group.isActive = true;
      group.isCompleted = false;
    } else if (index > fsmState.current_split_index) {
      group.isCompleted = false;
    }

    if (split.actual_duration_ms !== null) {
      group.totalActTimeMs += split.actual_duration_ms;
    }
    group.totalRefTimeMs += split.ref_duration_ms;
  });

  const groupedSplits = Array.from(groupedSplitsMap.values()).sort((a, b) => {
    const minA = Math.min(...a.splits.map(s => s.originalIndex));
    const minB = Math.min(...b.splits.map(s => s.originalIndex));
    return minA - minB;
  });

  return (
    <div 
      style={styles.appContainer(opacity, justTimer)}
      onContextMenu={(e) => {
        e.preventDefault();
        invoke('show_context_menu', { justTimer, alwaysOnTop: isAlwaysOnTop, isPaused: fsmState.is_paused }).catch(() => {});
      }}
    >
      {!justTimer && (
        <header 
          style={{ ...styles.header, cursor: 'move', userSelect: 'none' }}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (e.button === 0 && target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
              invoke('start_dragging').catch(() => {});
            }
          }}
        >
          <div style={styles.logoGroup}>
            <div style={styles.logoDot} />
            <h1 style={styles.logoText}>POE2 TIMER</h1>
          </div>
          <div style={styles.widgetControls}>
            <button 
              onClick={() => setIsAlwaysOnTop(!isAlwaysOnTop)} 
              style={styles.widgetButton(isAlwaysOnTop)}
              title="Always on Top (Закрепить поверх окон)"
            >
              📌
            </button>
            <div style={styles.opacityControl}>
              <input 
                type="range" 
                min="0.0" 
                max="1.0" 
                step="0.05" 
                value={opacity} 
                onChange={(e) => setOpacity(parseFloat(e.target.value))} 
                style={styles.opacityRange}
                title={`Прозрачность: ${Math.round(opacity * 100)}%`}
              />
            </div>
            <div style={styles.statusBadge(fsmState.is_in_town, fsmState.mode !== 'Idle')}>
              {fsmState.mode === 'Idle' 
                ? 'IDLE' 
                : fsmState.is_in_town 
                  ? 'TOWN' 
                  : 'COMBAT'}
            </div>
          </div>
        </header>
      )}

      {!justTimer && (
        <div style={styles.tabsContainer}>
          <button 
            style={styles.tabButton(activeTab === 'timer')}
            onClick={() => setActiveTab('timer')}
          >
            Timer
          </button>
          <button 
            style={styles.tabButton(activeTab === 'analytics')}
            onClick={() => {
              setActiveTab('analytics');
            }}
          >
            Stats
          </button>
          <button 
            style={styles.tabButton(activeTab === 'settings')}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      )}

      {!justTimer && errorMsg && <div style={styles.errorMessage}>{errorMsg}</div>}
      {!justTimer && successMsg && <div style={styles.successMessage}>{successMsg}</div>}

      <main style={styles.mainContent}>
        {activeTab === 'timer' && (
          justTimer ? (
            <div 
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                
                if (e.detail === 2) {
                  if (dragTimeoutRef.current) {
                    clearTimeout(dragTimeoutRef.current);
                    dragTimeoutRef.current = null;
                  }
                  setJustTimer(false);
                } else if (e.detail === 1) {
                  if (dragTimeoutRef.current) {
                    clearTimeout(dragTimeoutRef.current);
                  }
                  dragTimeoutRef.current = setTimeout(() => {
                    invoke('start_dragging').catch(() => {});
                    dragTimeoutRef.current = null;
                  }, 150);
                }
              }}
              style={styles.justTimerWidget(fsmState.is_paused, isLong)}
              title="Перетащите мышкой. Двойной клик для возврата."
            >
              {formatTime(fsmState.total_elapsed_ms)}
            </div>
          ) : (
            <div style={styles.timerLayout}>
              <div style={styles.mainTimerCard} className="glass-panel">
                <span style={styles.timerLabel}>TOTAL TIME</span>
                <div style={styles.hugeTimer(fsmState.is_paused)} className="timer-font">
                  {formatTime(fsmState.total_elapsed_ms)}
                </div>
                <div style={styles.timerSubGrid}>
                  <div style={styles.timerSubItem}>
                    <span style={styles.subTimerLabel}>TOWN TIME</span>
                    <span style={styles.subTimerValue} className="timer-font">
                      {formatTime(fsmState.total_town_time_ms)}
                    </span>
                  </div>
                  <div style={styles.timerSubItem}>
                    <span style={styles.subTimerLabel}>CURRENT ZONE</span>
                    <span style={styles.subTimerValueAccent}>
                      {fsmState.current_zone}
                    </span>
                  </div>
                </div>
              </div>

              {!justTimer && (
                <div style={styles.splitsContainer} className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0 }}>
                    <span style={styles.sectionTitle}>Route Splits</span>
                    {fsmState.route_splits.length > 0 && (
                      <button 
                        style={styles.editModeButton(isEditMode)} 
                        onClick={() => {
                          setIsEditMode(!isEditMode);
                          setDraggedIndex(null);
                        }}
                      >
                        {isEditMode ? '💾 Done' : '✏️ Edit'}
                      </button>
                    )}
                  </div>
                  <div style={styles.splitsList}>
                    {groupedSplits.length === 0 ? (
                      <div style={styles.emptyStateText}>
                        No splits. Start a Shadow Run to generate a route, or load a route in Speedrun Mode.
                      </div>
                    ) : (
                      groupedSplits.map((group, groupIndex) => (
                        <div key={`group-${groupIndex}`} style={{ marginBottom: '8px' }}>
                          <div style={styles.actHeaderRow}>
                            <span style={styles.actHeaderTitle}>{group.actName}</span>
                            <div style={{ display: 'flex', justifyContent: 'center' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <span style={styles.actHeaderTime(group.isActive)}>
                                {formatTime(group.totalActTimeMs)}
                                </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {group.splits.map((split) => {
                              const isActive = split.originalIndex === fsmState.current_split_index;
                              const isCompleted = split.actual_duration_ms !== null && !isActive;
                              
                              const refDuration = split.ref_duration_ms;
                              const actualDuration = split.actual_duration_ms;
                              const delta = split.delta_ms;

                              const displayRefText = (refDuration === 0 && isCompleted && actualDuration !== null)
                                ? formatTime(actualDuration)
                                : formatTime(refDuration);
                              
                              const isDragged = split.originalIndex === draggedIndex;
                              
                              return (
                                <div 
                                  key={split.originalIndex} 
                                  ref={isActive ? activeSplitRef : null}
                                  style={styles.splitRow(isActive, isCompleted, isDragged, isEditMode)}
                                  draggable={isEditMode && !isActTriggerZone(split.zone_name)}
                                  onDragStart={(e) => handleDragStart(e, split.originalIndex)}
                                  onDragOver={(e) => handleDragOver(e, split.originalIndex)}
                                  onDragEnter={(e) => handleDragEnter(e, split.originalIndex)}
                                  onDrop={(e) => handleDrop(e, split.originalIndex)}
                                  onDragEnd={handleDragEnd}
                                >
                                  <div style={styles.splitMainInfo}>
                                    {isEditMode && !isActTriggerZone(split.zone_name) && (
                                      <span style={{ color: '#64748b', fontSize: '11px', cursor: 'grab', userSelect: 'none', marginRight: '1px' }}>
                                        ☰
                                      </span>
                                    )}
                                    <span style={styles.splitIndex}>
                                      {split.visit_number !== null && split.visit_number !== undefined
                                        ? split.visit_number.toString().padStart(2, '0')
                                        : '--'}
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                      <span style={styles.splitName}>{split.zone_name}</span>
                                      <span style={styles.splitDurationsSubtext}>
                                        {displayRefText}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div style={styles.splitDeltaColumn}>
                                    {delta !== null && refDuration > 0 && (
                                      <span style={styles.splitDelta(delta)}>
                                        {formatDelta(delta)}
                                      </span>
                                    )}
                                  </div>

                                  <div style={styles.splitCumulativeColumn}>
                                    {(isCompleted || isActive) && actualDuration !== null && (
                                      <span style={styles.actCumulativeText(isActive)}>
                                        {formatTime(actualDuration)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {!justTimer && (
                <div style={styles.quickControls}>
                  {fsmState.mode === 'Idle' ? (
                    <>
                      <button 
                        style={styles.actionButton('#10b981')} 
                        onClick={() => handleStartRun('ShadowRecord')}
                      >
                        Start Blind Run (Shadow Record)
                      </button>
                      <button 
                        style={styles.actionButton('#8b5cf6')} 
                        onClick={handleResumeClick}
                      >
                        Resume Run
                      </button>
                      <button 
                        style={styles.actionButton('#06b6d4')} 
                        onClick={() => handleStartRun('Speedrun')}
                      >
                        Start Speedrun Mode
                      </button>
                      {fsmState.route_splits.length > 0 && (
                        <button 
                          style={styles.actionButton('#475569')} 
                          onClick={handleResetRun}
                        >
                          Clear Splits
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button 
                        style={styles.actionButton(fsmState.is_paused ? '#10b981' : '#d97706')} 
                        onClick={() => invoke('toggle_pause').catch(() => {})}
                      >
                        {fsmState.is_paused ? '▶ Resume Timer' : '⏸ Pause Timer'}
                      </button>
                      <button 
                        style={styles.actionButton('#ef4444')} 
                        onClick={handleStopRun}
                      >
                        Stop Timer & Save Run
                      </button>
                      <button 
                        style={styles.actionButton('#475569')} 
                        onClick={handleResetRun}
                      >
                        Reset Run
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'analytics' && (() => {
          const validSplits = fsmState.route_splits.filter(s => s.ref_duration_ms > 0 || s.actual_duration_ms !== null);
          const globalMaxMs = Math.max(1, ...validSplits.map(s => Math.max(s.ref_duration_ms, s.actual_duration_ms || 0)));
          const maxActMs = Math.max(1, ...groupedSplits.map(g => Math.max(g.totalRefTimeMs, g.totalActTimeMs)));

          return (
            <div style={styles.analyticsLayout} className="glass-panel">
              <div style={styles.analyticsHeader}>
                <h2 style={styles.sectionTitle}>Run Performance (Actual vs Reference)</h2>
              </div>
              
              <div style={styles.chartContainer}>
                {validSplits.length === 0 ? (
                  <div style={styles.emptyStateText}>
                    No segment data available. Complete segments to view charts.
                  </div>
                ) : (
                  groupedSplits.map((group, groupIdx) => {
                    const groupValidSplits = group.splits.filter(s => s.ref_duration_ms > 0 || s.actual_duration_ms !== null);
                    if (groupValidSplits.length === 0) return null;

                    const refActMs = group.totalRefTimeMs;
                    const actActMs = group.totalActTimeMs;
                    const isActSlower = actActMs > refActMs;
                    const actActualColor = isActSlower ? '#ef4444' : '#10b981';
                    const actRefColor = 'rgba(255, 255, 255, 0.2)';
                    const refActWidth = `${(refActMs / maxActMs) * 98}%`;
                    const actActWidth = `${(actActMs / maxActMs) * 98}%`;
                    const isExpanded = !!expandedActs[group.actName];
                    const actDelta = actActMs - refActMs;

                    return (
                      <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div 
                          onClick={() => setExpandedActs(prev => ({ ...prev, [group.actName]: !prev[group.actName] }))}
                          style={styles.chartActHeader}
                          className="chart-act-header"
                        >
                          <div style={styles.chartActLabels}>
                            <span style={styles.chartActName}>
                              {isExpanded ? '▼ ' : '▶ '} {group.actName}
                            </span>
                            <span style={styles.chartActTimeDiff(isActSlower)}>
                              {refActMs > 0 ? formatDelta(actDelta) : ''}
                            </span>
                          </div>
                          <div style={styles.barTrackAct}>
                            {isActSlower ? (
                              <>
                                <div style={styles.bar(actActWidth, actActualColor, 1)} title={`Actual: ${formatTime(actActMs)}`} />
                                <div style={styles.bar(refActWidth, actRefColor, 2)} title={`Reference: ${formatTime(refActMs)}`} />
                              </>
                            ) : (
                              <>
                                <div style={styles.bar(refActWidth, actRefColor, 1)} title={`Reference: ${formatTime(refActMs)}`} />
                                <div style={styles.bar(actActWidth, actActualColor, 2)} title={`Actual: ${formatTime(actActMs)}`} />
                              </>
                            )}
                          </div>
                          <div style={styles.chartActTimeSubtext}>
                            <span style={{ color: '#94a3b8' }}>Ref: {formatTime(refActMs)}</span>
                            <span style={{ color: actActualColor }}>Act: {formatTime(actActMs)}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={styles.chartActChildren}>
                            {groupValidSplits.map((split, zoneIdx) => {
                              const refMs = split.ref_duration_ms;
                              const actMs = split.actual_duration_ms || 0;
                              const isSlower = actMs > refMs;
                              const actualColor = isSlower ? '#ef4444' : '#10b981';
                              const refColor = 'rgba(255, 255, 255, 0.15)';
                              const refWidth = `${(refMs / globalMaxMs) * 98}%`;
                              const actWidth = `${(actMs / globalMaxMs) * 98}%`;

                              return (
                                <div key={zoneIdx} style={styles.chartRowChild}>
                                  <div style={styles.chartLabels}>
                                    <span style={styles.chartZoneNameChild}>{split.zone_name}</span>
                                    <span style={styles.chartTimeDiff(isSlower)}>
                                      {split.delta_ms !== null && refMs > 0 ? formatDelta(split.delta_ms) : ''}
                                    </span>
                                  </div>
                                  <div style={styles.barTrackChild}>
                                    {isSlower ? (
                                      <>
                                        <div style={styles.bar(actWidth, actualColor, 1)} title={`Actual: ${formatTime(actMs)}`} />
                                        <div style={styles.bar(refWidth, refColor, 2)} title={`Reference: ${formatTime(refMs)}`} />
                                      </>
                                    ) : (
                                      <>
                                        <div style={styles.bar(refWidth, refColor, 1)} title={`Reference: ${formatTime(refMs)}`} />
                                        <div style={styles.bar(actWidth, actualColor, 2)} title={`Actual: ${formatTime(actMs)}`} />
                                      </>
                                    )}
                                  </div>
                                  <div style={styles.chartTimeSubtextChild}>
                                    <span style={{ color: '#94a3b8' }}>Ref: {formatTime(refMs)}</span>
                                    <span style={{ color: actualColor }}>Act: {formatTime(actMs)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'settings' && (
          <div style={styles.settingsLayout} className="glass-panel">
            <h2 style={styles.sectionTitle}>Configuration & Paths</h2>
            
            <div style={styles.settingsGroup}>
              <label style={styles.settingLabel}>PoE 2 Client.txt File Path</label>
              <div style={styles.inputGroup}>
                <input 
                  type="text" 
                  style={styles.inputField} 
                  placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt" 
                  value={clientPath}
                  onChange={(e) => setClientPath(e.target.value)}
                />
                <button 
                  style={styles.inputButton} 
                  onClick={() => initializeClientPath(clientPath)}
                >
                  Verify & Track
                </button>
              </div>
              <span style={styles.inputHelp}>
                This file is monitored in real-time to update zone progression.
              </span>
            </div>

            <div style={styles.settingsGroup}>
              <label style={styles.settingLabel}>Reference Route JSON Path (for Speedrun Mode)</label>
              <div style={styles.inputGroup}>
                <input 
                  type="text" 
                  style={styles.inputField} 
                  placeholder="e.g. C:\Users\User\Desktop\my_poe_route.json" 
                  value={routePath}
                  onChange={(e) => {
                    setRoutePath(e.target.value);
                    localStorage.setItem('poe_route_path', e.target.value);
                  }}
                />
                <button 
                  style={styles.inputButton} 
                  onClick={async () => {
                    const selected = await invoke<string | null>('select_route_file');
                    if (selected) {
                      setRoutePath(selected);
                      localStorage.setItem('poe_route_path', selected);
                    }
                  }}
                >
                  Browse
                </button>
              </div>
              <span style={styles.inputHelp}>
                JSON Route graph generated from a previous Shadow Record run.
              </span>
            </div>

            <div style={styles.settingsGroup}>
              <label style={{ ...styles.settingLabel, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={isMuling} 
                  onChange={(e) => setIsMuling(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#06b6d4' }}
                />
                Muling Mode (Ignore first mule run)
              </label>
              <span style={styles.inputHelp}>
                Useful when creating a mule character for the stash. Segment timers will start only on the second visit to The Riverbank, but Total Time keeps running.
              </span>
            </div>

            <div style={styles.settingsGroup}>
              <label style={{ ...styles.settingLabel, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={justTimer} 
                  onChange={(e) => setJustTimer(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#06b6d4' }}
                />
                Just Timer Mode
              </label>
              <span style={styles.inputHelp}>
                Hides the splits container on the main screen while keeping the background recording active.
              </span>
            </div>
          </div>
        )}
      </main>

      {showResetConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="glass-panel">
            <h3 style={styles.modalTitle}>Overwrite splits?</h3>
            <p style={styles.modalText}>
              Do you want to overwrite the splits in the original route file with the new times from this run?
            </p>
            <div style={styles.modalButtonContainer}>
              <button 
                style={styles.modalButton('#10b981')} 
                onClick={() => performReset(true)}
              >
                Yes, overwrite
              </button>
              <button 
                style={styles.modalButton('#ef4444')} 
                onClick={() => performReset(false)}
              >
                No, reset without saving
              </button>
              <button 
                style={styles.modalButton('#475569')} 
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showResumeModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="glass-panel">
            <h3 style={styles.modalTitle}>Resume Run</h3>
            <p style={styles.modalText}>
              Select the mode to resume the loaded route:
            </p>
            <div style={styles.modalButtonContainer}>
              <button 
                style={styles.modalButton('#06b6d4')} 
                onClick={() => performResume('Speedrun')}
              >
                Speedrun Mode
              </button>
              <button 
                style={styles.modalButton('#10b981')} 
                onClick={() => performResume('ShadowRecord')}
              >
                Blind Run (Shadow Record)
              </button>
              <button 
                style={styles.modalButton('#475569')} 
                onClick={() => {
                  setShowResumeModal(false);
                  setPendingResumePath(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: (opacity: number, justTimer: boolean) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    height: justTimer ? 'auto' : '100vh',
    padding: justTimer ? '0px' : '6px 10px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box' as const,
    overflow: justTimer ? 'visible' : 'hidden',
    backgroundColor: justTimer ? 'transparent' : `rgba(7, 10, 19, ${opacity})`,
    borderRadius: justTimer ? '0px' : '10px',
    border: justTimer ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
  }),
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  logoDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#06b6d4',
    boxShadow: '0 0 4px #06b6d4',
  },
  logoText: {
    fontSize: '13px',
    fontWeight: 900,
    letterSpacing: '0.5px',
    margin: 0,
    background: 'linear-gradient(90deg, #fff 0%, #a5f3fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  widgetControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  widgetButton: (active: boolean) => ({
    backgroundColor: active ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
    border: '1px solid',
    borderColor: active ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.1)',
    color: active ? '#06b6d4' : '#94a3b8',
    borderRadius: '4px',
    padding: '1px 4px',
    fontSize: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  }),
  opacityControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  opacityRange: {
    width: '45px',
    height: '4px',
    cursor: 'pointer',
    accentColor: '#06b6d4',
  },
  statusBadge: (isInTown: boolean, isActive: boolean) => ({
    padding: '2px 6px',
    borderRadius: '20px',
    fontSize: '9px',
    fontWeight: 700 as const,
    letterSpacing: '0.5px',
    border: '1px solid',
    transition: 'all 0.3s ease',
    backgroundColor: !isActive
      ? 'rgba(255, 255, 255, 0.05)'
      : isInTown
        ? 'rgba(245, 158, 11, 0.1)'
        : 'rgba(16, 185, 129, 0.1)',
    borderColor: !isActive
      ? 'rgba(255, 255, 255, 0.15)'
      : isInTown
        ? '#f59e0b'
        : '#10b981',
    color: !isActive
      ? '#94a3b8'
      : isInTown
        ? '#fbbf24'
        : '#34d399',
    boxShadow: !isActive
      ? 'none'
      : isInTown
        ? '0 0 6px rgba(245, 158, 11, 0.15)'
        : '0 0 6px rgba(16, 185, 129, 0.15)',
  }),
  tabsContainer: {
    display: 'flex',
    gap: '4px',
    marginBottom: '6px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    paddingBottom: '3px',
  },
  tabButton: (isActive: boolean) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
    border: '1px solid',
    borderColor: isActive ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
    color: isActive ? '#38bdf8' : '#94a3b8',
    cursor: 'pointer',
    fontWeight: 600 as const,
    transition: 'all 0.2s ease',
    fontSize: '11px',
  }),
  errorMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    color: '#fca5a5',
    padding: '6px 10px',
    marginBottom: '8px',
    fontSize: '12px',
  },
  successMessage: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid #10b981',
    borderRadius: '4px',
    color: '#a7f3d0',
    padding: '6px 10px',
    marginBottom: '8px',
    fontSize: '12px',
  },
  justTimerWidget: (isPaused: boolean, isLong: boolean) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontVariantNumeric: 'tabular-nums' as const,
    fontWeight: 700,
    fontSize: '32px',
    color: isPaused ? '#f59e0b' : '#ffffff',
    textShadow: isPaused ? '0 0 8px rgba(245, 158, 11, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.4)',
    cursor: 'move',
    userSelect: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: isLong ? '200px' : '160px',
    height: '40px',
    boxSizing: 'border-box' as const,
    overflow: 'hidden',
    animation: isPaused ? 'pulse 2s infinite ease-in-out' : 'none',
  }),
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minHeight: 0,
  },
  timerLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minHeight: 0,
    gap: '8px',
  },
  mainTimerCard: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
    position: 'relative' as const,
  },
  timerLabel: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#94a3b8',
  },
  hugeTimer: (isPaused: boolean) => ({
    fontSize: '32px',
    lineHeight: 1.1,
    color: isPaused ? '#f59e0b' : '#ffffff',
    textShadow: isPaused ? '0 0 10px rgba(245, 158, 11, 0.3)' : '0 0 10px rgba(255, 255, 255, 0.1)',
    animation: isPaused ? 'pulse 2s infinite ease-in-out' : 'none',
  }),
  timerSubGrid: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '6px',
    marginTop: '4px',
    gap: '10px',
  },
  timerSubItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1px',
    flex: 1,
  },
  subTimerLabel: {
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: '#64748b',
  },
  subTimerValue: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#f1f5f9',
  },
  subTimerValueAccent: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#38bdf8',
    textAlign: 'center' as const,
  },
  splitsContainer: {
    padding: '8px 12px',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: '#94a3b8',
    margin: '0 0 6px 0',
    textTransform: 'uppercase' as const,
    flexShrink: 0,
  },
  splitsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    overflowY: 'auto' as const,
    minHeight: 0,
    paddingRight: '4px',
  },
  emptyStateText: {
    color: '#64748b',
    textAlign: 'center' as const,
    padding: '16px 0',
    fontSize: '12px',
  },
  editModeButton: (isEdit: boolean) => ({
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: isEdit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
    border: '1px solid',
    borderColor: isEdit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)',
    color: isEdit ? '#10b981' : '#94a3b8',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }),
  actHeaderRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 65px 65px',
    alignItems: 'center',
    padding: '6px 8px',
    backgroundColor: 'rgba(56, 189, 248, 0.04)',
    borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
    marginTop: '4px',
    marginBottom: '6px',
    borderRadius: '4px 4px 0 0',
  },
  actHeaderTitle: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#38bdf8',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  actHeaderTime: (isActive: boolean) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    fontWeight: 700,
    color: isActive ? '#f1f5f9' : '#94a3b8',
  }),
  splitRow: (isActive: boolean, isCompleted: boolean, isDragged: boolean, isEditMode: boolean) => ({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 65px 65px',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid',
    backgroundColor: isDragged
      ? 'rgba(56, 189, 248, 0.15)'
      : isActive 
        ? 'rgba(56, 189, 248, 0.06)' 
        : 'rgba(255, 255, 255, 0.02)',
    borderColor: isDragged
      ? '#38bdf8'
      : isActive 
        ? 'rgba(56, 189, 248, 0.25)' 
        : isCompleted 
          ? 'rgba(255, 255, 255, 0.06)' 
          : 'transparent',
    opacity: isDragged ? 0.5 : (isCompleted ? 0.75 : 1),
    transition: 'all 0.2s ease',
    cursor: isEditMode ? (isDragged ? 'grabbing' : 'grab') : 'default',
  }),
  splitMainInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
  },
  splitIndex: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    color: '#64748b',
    flexShrink: 0,
  },
  splitName: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#f1f5f9',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  splitDurationsSubtext: {
    fontSize: '10px',
    color: '#64748b',
    fontFamily: 'JetBrains Mono, monospace',
    marginTop: '1px',
  },
  splitDeltaColumn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitCumulativeColumn: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actCumulativeText: (isActive: boolean) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    fontWeight: isActive ? 700 as const : 500 as const,
    color: isActive ? '#38bdf8' : '#f1f5f9',
  }),
  splitDelta: (delta: number) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    fontWeight: 700 as const,
    color: delta <= 0 ? '#10b981' : '#ef4444',
  }),
  quickControls: {
    display: 'flex',
    gap: '6px',
    marginTop: '2px',
    flexShrink: 0,
  },
  actionButton: (color: string) => ({
    flex: 1,
    backgroundColor: color,
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 700 as const,
    cursor: 'pointer',
    transition: 'transform 0.1s ease, filter 0.2s ease',
    boxShadow: `0 4px 8px ${color}22`,
  }),
  analyticsLayout: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1,
    minHeight: 0,
  },
  analyticsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '8px',
  },
  chartContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    overflowY: 'auto' as const,
    flex: 1,
    paddingRight: '6px',
  },
  chartRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  chartLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartZoneName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  chartTimeDiff: (isSlower: boolean) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    fontWeight: 700 as const,
    color: isSlower ? '#ef4444' : '#10b981',
  }),
  chartTimeSubtext: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '9px',
  },
  barTrack: {
    position: 'relative' as const,
    height: '14px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  bar: (width: string, color: string, zIndex: number) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    height: '100%',
    width,
    backgroundColor: color,
    zIndex,
    borderRadius: '3px',
    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  }),
  trHover: {
    transition: 'background-color 0.2s ease',
  },
  settingsLayout: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    flex: 1,
    overflowY: 'auto' as const,
  },
  settingsGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  settingLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
  },
  inputField: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  inputButton: {
    backgroundColor: '#38bdf8',
    color: '#0f172a',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 700 as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  inputHelp: {
    fontSize: '11px',
    color: '#64748b',
  },
  modalOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 10, 19, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
    borderRadius: '10px',
  },
  modalContent: {
    padding: '20px',
    maxWidth: '300px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    textAlign: 'center' as const,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: 0,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  modalText: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.5',
  },
  modalButtonContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    gap: '8px',
    marginTop: '8px',
  },
  modalButton: (color: string) => ({
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: color,
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
    boxShadow: `0 4px 6px -1px ${color}1A`,
  }),
  chartActHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '10px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    marginBottom: '4px',
  },
  chartActLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartActName: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#38bdf8',
    letterSpacing: '0.5px',
  },
  chartActTimeDiff: (isSlower: boolean) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    fontWeight: 800 as const,
    color: isSlower ? '#ef4444' : '#10b981',
  }),
  barTrackAct: {
    position: 'relative' as const,
    height: '16px',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  chartActTimeSubtext: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
  },
  chartActChildren: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    paddingLeft: '16px',
    borderLeft: '1px solid rgba(56, 189, 248, 0.15)',
    marginLeft: '6px',
    marginTop: '4px',
    marginBottom: '8px',
  },
  chartRowChild: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '3px',
  },
  chartZoneNameChild: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#e2e8f0',
  },
  barTrackChild: {
    position: 'relative' as const,
    height: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '3px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  chartTimeSubtextChild: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '8.5px',
  },
};