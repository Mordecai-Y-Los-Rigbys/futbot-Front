const MOCK_DELAY_MS = 350;
let nextPlayerId = 1;

export async function createPlayerMock(playerData) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  return {
    id: nextPlayerId++,
    ...playerData,
  };
}
