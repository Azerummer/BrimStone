const CARD_LIBRARY = {
  strike: {
    id: "strike",
    name: "斩击",
    type: "攻击",
    cost: 1,
    description: "造成 6 点伤害。",
    play: (state) => dealDamage(state.enemy, 6),
  },
  guard: {
    id: "guard",
    name: "格挡",
    type: "技能",
    cost: 1,
    description: "获得 6 点护甲。",
    play: (state) => gainBlock(state.player, 6),
  },
  fireball: {
    id: "fireball",
    name: "火球术",
    type: "攻击",
    cost: 2,
    description: "造成 12 点伤害。",
    play: (state) => dealDamage(state.enemy, 12),
  },
  bandage: {
    id: "bandage",
    name: "急救绷带",
    type: "技能",
    cost: 1,
    description: "回复 5 点生命。",
    play: (state) => heal(state.player, 5),
  },
  bash: {
    id: "bash",
    name: "重击",
    type: "攻击",
    cost: 2,
    description: "造成 8 点伤害并获得 5 护甲。",
    play: (state) => {
      dealDamage(state.enemy, 8);
      gainBlock(state.player, 5);
    },
  },
  focus: {
    id: "focus",
    name: "专注",
    type: "技能",
    cost: 0,
    description: "抽 1 张牌并获得 1 点能量。",
    play: (state) => {
      drawCards(state, 1);
      state.player.energy += 1;
      log("你通过专注恢复了 1 点能量。");
    },
  },
};

const ENEMIES = [
  {
    name: "灰烬鼠群",
    maxHp: 30,
    intents: [
      { type: "attack", value: 7, text: "撕咬 7" },
      { type: "block", value: 6, text: "蜷缩并获得 6 护甲" },
    ],
  },
  {
    name: "失控哨兵",
    maxHp: 40,
    intents: [
      { type: "attack", value: 10, text: "重拳 10" },
      { type: "buffAttack", value: 2, text: "充能（本战斗攻击 +2）" },
    ],
  },
  {
    name: "虚空祭司",
    maxHp: 46,
    intents: [
      { type: "attack", value: 8, text: "暗影箭 8" },
      { type: "drain", value: 6, text: "吸取生命 6" },
    ],
  },
  {
    name: "终末机甲",
    maxHp: 55,
    intents: [
      { type: "attack", value: 12, text: "炮击 12" },
      { type: "block", value: 10, text: "装甲展开 +10 护甲" },
    ],
  },
];

const state = {
  floor: 1,
  maxFloor: 6,
  player: {
    hp: 70,
    maxHp: 70,
    block: 0,
    energy: 3,
    maxEnergy: 3,
    attackBuff: 0,
  },
  enemy: null,
  deck: [],
  drawPile: [],
  discardPile: [],
  hand: [],
  rewardPool: ["fireball", "bandage", "bash", "focus", "strike", "guard"],
  rewardPending: false,
  inCombat: false,
};

const el = {
  floorInfo: document.getElementById("floorInfo"),
  playerHp: document.getElementById("playerHp"),
  playerMaxHp: document.getElementById("playerMaxHp"),
  playerBlock: document.getElementById("playerBlock"),
  playerEnergy: document.getElementById("playerEnergy"),
  playerMaxEnergy: document.getElementById("playerMaxEnergy"),
  drawCount: document.getElementById("drawCount"),
  discardCount: document.getElementById("discardCount"),
  enemyName: document.getElementById("enemyName"),
  enemyHp: document.getElementById("enemyHp"),
  enemyMaxHp: document.getElementById("enemyMaxHp"),
  enemyBlock: document.getElementById("enemyBlock"),
  enemyIntent: document.getElementById("enemyIntent"),
  hand: document.getElementById("hand"),
  endTurnBtn: document.getElementById("endTurnBtn"),
  restartBtn: document.getElementById("restartBtn"),
  rewardSection: document.getElementById("rewardSection"),
  rewardCards: document.getElementById("rewardCards"),
  skipRewardBtn: document.getElementById("skipRewardBtn"),
  logList: document.getElementById("logList"),
  cardTemplate: document.getElementById("cardTemplate"),
};

function initGame() {
  state.floor = 1;
  state.player.hp = 70;
  state.player.block = 0;
  state.player.energy = 3;
  state.player.attackBuff = 0;
  state.deck = [
    "strike", "strike", "strike", "strike", "strike",
    "guard", "guard", "guard", "guard", "focus",
  ];
  state.discardPile = [];
  state.hand = [];
  state.rewardPending = false;
  state.inCombat = true;
  el.logList.innerHTML = "";
  log("新的远征开始了。愿你活着见到黎明。", true);
  startCombat();
}

function startCombat() {
  const base = ENEMIES[Math.min(state.floor - 1, ENEMIES.length - 1)];
  const extraHp = (state.floor - 1) * 4;
  state.enemy = {
    name: base.name,
    hp: base.maxHp + extraHp,
    maxHp: base.maxHp + extraHp,
    block: 0,
    intents: base.intents,
    attackBuff: 0,
    nextIntentIndex: 0,
  };

  state.drawPile = shuffle([...state.deck]);
  state.discardPile = [];
  state.hand = [];
  state.player.block = 0;
  state.player.energy = state.player.maxEnergy;
  drawCards(state, 5);
  chooseEnemyIntent();
  state.inCombat = true;
  render();
  log(`遭遇敌人：${state.enemy.name}！`);
}

function chooseEnemyIntent() {
  if (!state.enemy) return;
  const index = state.enemy.nextIntentIndex % state.enemy.intents.length;
  state.enemy.intent = state.enemy.intents[index];
  state.enemy.nextIntentIndex += 1;
}

function drawCards(s, count) {
  for (let i = 0; i < count; i++) {
    if (s.drawPile.length === 0) {
      if (s.discardPile.length === 0) return;
      s.drawPile = shuffle([...s.discardPile]);
      s.discardPile = [];
      log("你洗切了弃牌堆。", true);
    }
    s.hand.push(s.drawPile.pop());
  }
}

function playCard(handIndex) {
  if (!state.inCombat || state.rewardPending) return;
  const cardId = state.hand[handIndex];
  const card = CARD_LIBRARY[cardId];
  if (!card) return;

  if (card.cost > state.player.energy) {
    log(`能量不足，无法打出 ${card.name}。`);
    return;
  }

  state.player.energy -= card.cost;
  log(`你打出【${card.name}】。`);
  card.play(state);

  const [usedCard] = state.hand.splice(handIndex, 1);
  state.discardPile.push(usedCard);

  if (state.enemy.hp <= 0) {
    winCombat();
    return;
  }

  render();
}

function endTurn() {
  if (!state.inCombat || state.rewardPending) return;
  state.discardPile.push(...state.hand);
  state.hand = [];

  enemyAct();
  if (state.player.hp <= 0) {
    loseGame();
    return;
  }

  state.player.block = 0;
  state.enemy.block = 0;
  state.player.energy = state.player.maxEnergy;
  drawCards(state, 5);
  chooseEnemyIntent();
  render();
}

function enemyAct() {
  const intent = state.enemy.intent;
  if (!intent) return;

  if (intent.type === "attack") {
    const dmg = intent.value + state.enemy.attackBuff;
    const dealt = dealDamage(state.player, dmg);
    log(`${state.enemy.name} 发动攻击，造成 ${dealt} 点伤害。`);
  } else if (intent.type === "block") {
    gainBlock(state.enemy, intent.value);
    log(`${state.enemy.name} 获得 ${intent.value} 护甲。`);
  } else if (intent.type === "buffAttack") {
    state.enemy.attackBuff += intent.value;
    log(`${state.enemy.name} 强化攻击，后续攻击 +${intent.value}。`);
  } else if (intent.type === "drain") {
    const dealt = dealDamage(state.player, intent.value);
    heal(state.enemy, dealt);
    log(`${state.enemy.name} 吸取你 ${dealt} 点生命。`);
  }
}

function winCombat() {
  state.inCombat = false;
  log(`你击败了 ${state.enemy.name}！`);

  if (state.floor >= state.maxFloor) {
    log("你成功穿越了灰烬远征，赢得了最终胜利！");
    render();
    return;
  }

  state.rewardPending = true;
  showReward();
  render();
}

function loseGame() {
  state.inCombat = false;
  log("你的生命归零，远征失败。点击“重新开局”再试一次。", true);
  render();
}

function showReward() {
  el.rewardSection.classList.remove("hidden");
  el.rewardCards.innerHTML = "";

  const options = shuffle([...state.rewardPool]).slice(0, 3);
  options.forEach((id) => {
    const cardNode = buildCardNode(CARD_LIBRARY[id], () => pickReward(id), false);
    el.rewardCards.appendChild(cardNode);
  });
}

function hideReward() {
  el.rewardSection.classList.add("hidden");
  el.rewardCards.innerHTML = "";
}

function pickReward(cardId) {
  state.deck.push(cardId);
  log(`你获得了新卡牌【${CARD_LIBRARY[cardId].name}】。`);
  proceedToNextFloor();
}

function skipReward() {
  log("你放弃了这次奖励。", true);
  proceedToNextFloor();
}

function proceedToNextFloor() {
  hideReward();
  state.rewardPending = false;
  state.floor += 1;

  if (state.floor % 2 === 0) {
    heal(state.player, 8);
    log("你在营地短暂休整，回复 8 点生命。", true);
  }

  startCombat();
}

function dealDamage(target, rawDamage) {
  const blockAbsorb = Math.min(target.block, rawDamage);
  target.block -= blockAbsorb;
  const hpDamage = Math.max(0, rawDamage - blockAbsorb);
  target.hp = Math.max(0, target.hp - hpDamage);
  return hpDamage;
}

function gainBlock(target, amount) {
  target.block += amount;
}

function heal(target, amount) {
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

function buildCardNode(card, onClick, disabled = false) {
  const node = el.cardTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".card-title").textContent = card.name;
  node.querySelector(".card-cost").textContent = `消耗：${card.cost}`;
  node.querySelector(".card-desc").textContent = card.description;
  node.querySelector(".card-type").textContent = card.type;
  node.disabled = disabled;
  if (!disabled) node.addEventListener("click", onClick);
  return node;
}

function render() {
  el.floorInfo.textContent = `第 ${Math.min(state.floor, state.maxFloor)} 层 / ${state.maxFloor}`;
  el.playerHp.textContent = state.player.hp;
  el.playerMaxHp.textContent = state.player.maxHp;
  el.playerBlock.textContent = state.player.block;
  el.playerEnergy.textContent = state.player.energy;
  el.playerMaxEnergy.textContent = state.player.maxEnergy;
  el.drawCount.textContent = state.drawPile.length;
  el.discardCount.textContent = state.discardPile.length;

  if (state.enemy) {
    el.enemyName.textContent = state.enemy.name;
    el.enemyHp.textContent = state.enemy.hp;
    el.enemyMaxHp.textContent = state.enemy.maxHp;
    el.enemyBlock.textContent = state.enemy.block;
    el.enemyIntent.textContent = state.enemy.intent ? state.enemy.intent.text : "-";
  }

  el.hand.innerHTML = "";
  state.hand.forEach((cardId, index) => {
    const card = CARD_LIBRARY[cardId];
    const disabled = card.cost > state.player.energy || !state.inCombat || state.rewardPending;
    const cardNode = buildCardNode(card, () => playCard(index), disabled);
    el.hand.appendChild(cardNode);
  });

  el.endTurnBtn.disabled = !state.inCombat || state.rewardPending;
}

function log(message, subtle = false) {
  const li = document.createElement("li");
  li.textContent = message;
  li.style.borderLeftColor = subtle ? "#64748b" : "#f59e0b";
  el.logList.prepend(li);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

el.endTurnBtn.addEventListener("click", endTurn);
el.restartBtn.addEventListener("click", initGame);
el.skipRewardBtn.addEventListener("click", skipReward);

initGame();
