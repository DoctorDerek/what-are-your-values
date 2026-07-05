export interface GridMetrics {
  frame_width_px: number
  frame_height_px: number
  sheet_columns: number
  sheet_rows: number
  sheet_width_px: number
  sheet_height_px: number
}

export interface AnimationState {
  playback: "loop" | "once" | "hold"
  row: number
  cols: [number, number]
}

export interface SequenceState {
  [substate: string]: AnimationState
}

export interface CompoundStateMachine {
  [state: string]: AnimationState | SequenceState
}

export interface Heroes99SpatialArchitecture {
  grid_metrics: GridMetrics
  z_index_stack_corrected: string[]
  compound_state_machine: CompoundStateMachine
}

export const HEROES99_SPATIAL_ARCHITECTURE: Heroes99SpatialArchitecture = {
  grid_metrics: {
    frame_width_px: 100,
    frame_height_px: 40,
    sheet_columns: 8,
    sheet_rows: 17,
    sheet_width_px: 800,
    sheet_height_px: 680,
  },
  z_index_stack_corrected: [
    "weapon_bot",
    "skin",
    "hair_bot",
    "face",
    "cloth_bot",
    "cloth_top",
    "hair_top",
    "weapon_top",
  ],
  compound_state_machine: {
    Idle1: {
      playback: "loop",
      row: 1,
      cols: [1, 6],
    },
    Idle2: {
      playback: "loop",
      row: 2,
      cols: [1, 6],
    },
    Run1: {
      playback: "loop",
      row: 3,
      cols: [1, 8],
    },
    Run2: {
      playback: "loop",
      row: 4,
      cols: [1, 8],
    },
    Jump_Sequence: {
      Takeoff: {
        playback: "once",
        row: 5,
        cols: [1, 4],
      },
      Fall_Loop: {
        playback: "loop",
        row: 5,
        cols: [5, 7],
      },
      Landing: {
        playback: "once",
        row: 5,
        cols: [8, 8],
      },
    },
    Attack1: {
      playback: "once",
      row: 6,
      cols: [1, 6],
    },
    Attack2: {
      playback: "once",
      row: 7,
      cols: [1, 6],
    },
    Attack3: {
      playback: "once",
      row: 8,
      cols: [1, 4],
    },
    AirAtk1: {
      playback: "once",
      row: 9,
      cols: [1, 6],
    },
    AirAtk2: {
      playback: "once",
      row: 10,
      cols: [1, 4],
    },
    Cast1_Sequence: {
      Windup: {
        playback: "once",
        row: 11,
        cols: [1, 2],
      },
      Channel_Loop: {
        playback: "loop",
        row: 11,
        cols: [3, 5],
      },
    },
    Cast2_Sequence: {
      Windup: {
        playback: "once",
        row: 12,
        cols: [1, 2],
      },
      Channel_Loop: {
        playback: "loop",
        row: 12,
        cols: [3, 5],
      },
    },
    Hurt: {
      playback: "once",
      row: 13,
      cols: [1, 4],
    },
    Dying: {
      playback: "once",
      row: 14,
      cols: [1, 5],
    },
    Dash_Sequence: {
      Startup: {
        playback: "once",
        row: 15,
        cols: [1, 2],
      },
      Glide_Loop: {
        playback: "loop",
        row: 15,
        cols: [3, 5],
      },
      Brake: {
        playback: "once",
        row: 15,
        cols: [6, 8],
      },
    },
    Block: {
      playback: "hold",
      row: 16,
      cols: [1, 5],
    },
    Roll: {
      playback: "once",
      row: 17,
      cols: [1, 8],
    },
  },
}
