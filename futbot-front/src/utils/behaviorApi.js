// API de comportamientos (fuente: "API DE CÓDIGO DE COMPORTAMIENTOS").
// `shared` lo usan ambos tipos. Una sección con `complete: false` indica que su lista
// todavía no está completa: el validador no marca como inválidas las llamadas
// desconocidas de ese tipo (las resuelve el 409 del servidor).
export const BEHAVIOR_API = {
  shared: {
    constants: [
      'field_length', 'field_width', 'goal_width', 'player_radius', 'ball_radius',
      'my_goal', 'opponent_goal', 'field_center',
      'bottom_left_corner', 'bottom_right_corner', 'top_left_corner', 'top_right_corner',
    ],
    functions: [
      'teammate_position', 'opponent_position', 'teammate_stat', 'opponent_stat',
      'ball_position', 'teammate_has_ball', 'opponent_has_ball', 'nobody_has_ball',
      'distance', 'elapsed_time', 'remaining_time', 'current_period',
    ],
  },
  playerBehavior: {
    constants: [],
    functions: [
      'move_in_direction', 'go_to', 'kick', 'kick_to',
      'my_position', 'my_number', 'i_have_ball',
    ],
  },
  // TODO: primitivas del DT (cambios de comportamiento y de jugador), no están en el documento.
  coachBehavior: { constants: [], functions: [], complete: false },
};