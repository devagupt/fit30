type Point = readonly [number, number];
type Limb = readonly [Point, Point];
type Path = readonly Point[];

interface Pose {
  head: Point;
  shoulder: Point;
  hip: Point;
  arm: Limb;
  leg: Limb;
  farArm?: Limb;
  farLeg?: Limb;
}

interface Guide {
  description: string;
  sample: (cycle: number) => Pose;
  equipment?: readonly Path[];
  handles?: (pose: Pose) => readonly Path[];
  ground?: number;
  static?: boolean;
  alternatePoseLabel?: string;
}

function between(start: Point, end: Point, amount: number): Point {
  return [start[0] + (end[0] - start[0]) * amount, start[1] + (end[1] - start[1]) * amount];
}

function betweenLimbs(start: Limb, end: Limb, amount: number): Limb {
  return [between(start[0], end[0], amount), between(start[1], end[1], amount)];
}

function repetition(start: Pose, end: Pose): Guide['sample'] {
  return (cycle) => {
    const amount = (1 - Math.cos(cycle * 2 * Math.PI)) / 2;
    return {
      head: between(start.head, end.head, amount),
      shoulder: between(start.shoulder, end.shoulder, amount),
      hip: between(start.hip, end.hip, amount),
      arm: betweenLimbs(start.arm, end.arm, amount),
      leg: betweenLimbs(start.leg, end.leg, amount),
      farArm: betweenLimbs(start.farArm ?? start.arm, end.farArm ?? end.arm, amount),
      farLeg: betweenLimbs(start.farLeg ?? start.leg, end.farLeg ?? end.leg, amount),
    };
  };
}

function walking(cycle: number): Pose {
  const angle = cycle * 2 * Math.PI;
  const step = 23 * Math.cos(angle);
  const lift = 8 * Math.sin(angle);
  const leg = (stride: number, height: number): Limb => [
    [121 + stride * 0.47, 89 - height * 0.6],
    [122 + stride, 115 - height],
  ];
  return {
    head: [129, 31], shoulder: [124, 47], hip: [120, 72],
    arm: [[120 - step * 0.3, 62], [130 - step * 0.58, 69]],
    farArm: [[117 + step * 0.3, 62], [127 + step * 0.58, 69]],
    leg: leg(step, Math.max(0, lift)),
    farLeg: leg(-step, Math.max(0, -lift)),
  };
}

function cycling(cycle: number): Pose {
  const angle = cycle * 2 * Math.PI;
  const leg = (phase: number): Limb => {
    const pedal: Point = [138 + 12 * Math.cos(phase), 98 + 12 * Math.sin(phase)];
    return [[(96 + pedal[0]) / 2 + 17, (67 + pedal[1]) / 2 - 8], pedal];
  };
  return {
    head: [114, 31], shoulder: [107, 47], hip: [96, 67],
    arm: [[127, 60], [150, 57]],
    leg: leg(angle), farLeg: leg(angle + Math.PI),
  };
}

const mat: Path = [[36, 118], [221, 118]];
const seat: readonly Path[] = [[[70, 85], [116, 85]], [[90, 86], [90, 115]]];
const seated: Pose = {
  head: [91, 32], shoulder: [91, 49], hip: [94, 78],
  arm: [[105, 62], [128, 64]], leg: [[129, 83], [139, 113]],
};
const pressStart: Pose = { ...seated, arm: [[82, 61], [111, 59]] };
const pressEnd: Pose = { ...seated, arm: [[123, 54], [155, 52]] };
const rowReach: Pose = { ...seated, arm: [[121, 60], [155, 64]] };
const rowPull: Pose = { ...seated, arm: [[78, 64], [109, 70]] };
const pulldownStart: Pose = { ...seated, arm: [[92, 28], [105, 14]], farArm: [[81, 28], [78, 14]] };
const pulldownEnd: Pose = { ...seated, arm: [[110, 63], [105, 53]], farArm: [[79, 62], [78, 53]] };
const legPressStart: Pose = {
  head: [65, 66], shoulder: [79, 80], hip: [111, 104],
  arm: [[85, 98], [109, 109]], leg: [[143, 78], [163, 93]],
};
const legPressEnd: Pose = { ...legPressStart, leg: [[152, 93], [189, 91]] };
const plank: Pose = {
  head: [64, 77], shoulder: [83, 86], hip: [134, 95],
  arm: [[82, 112], [59, 112]], leg: [[173, 103], [205, 111]],
};
const kneePlank: Pose = { ...plank, hip: [129, 98], leg: [[170, 113], [183, 105]] };
const quadruped: Pose = {
  head: [67, 74], shoulder: [87, 84], hip: [142, 85],
  arm: [[86, 99], [84, 114]], leg: [[142, 113], [167, 113]],
};
const bridgeStart: Pose = {
  head: [66, 107], shoulder: [86, 111], hip: [123, 111],
  arm: [[105, 114], [125, 115]], leg: [[151, 83], [174, 114]],
};
const bridgeEnd: Pose = { ...bridgeStart, hip: [119, 94] };
const bugStart: Pose = {
  head: [65, 106], shoulder: [84, 112], hip: [132, 112],
  arm: [[84, 90], [84, 68]], farArm: [[89, 91], [89, 72]],
  leg: [[132, 83], [163, 83]], farLeg: [[137, 87], [167, 87]],
};
const bugReach: Pose = {
  ...bugStart,
  arm: [[64, 102], [47, 97]],
  farLeg: [[158, 104], [186, 105]],
};
const calfStretch: Pose = {
  head: [127, 46], shoulder: [120, 62], hip: [97, 85],
  arm: [[143, 68], [167, 60]], leg: [[126, 96], [144, 115]], farLeg: [[83, 101], [64, 115]],
};

export const movementGuides: Record<string, Guide | undefined> = {
  treadmill_walk_jog: {
    description: 'Walk upright with an easy arm swing. Start briskly and jog only if comfortable.',
    sample: walking,
    equipment: [[[44, 119], [208, 119], [201, 114]], [[182, 117], [172, 58], [152, 58]], [[168, 59], [178, 49], [188, 49]]],
    ground: 123,
  },
  stationary_cycling: {
    description: 'Pedal smoothly with a comfortable torso position and moderate resistance.',
    sample: cycling,
    equipment: [
      [[63, 115], [185, 115]], [[95, 73], [100, 110], [138, 98], [153, 59], [143, 55]],
      [[100, 110], [165, 110], [153, 59]], [[85, 71], [101, 71]],
    ],
  },
  chest_press_machine: {
    description: 'Keep your upper back supported. Press smoothly and keep a soft bend in the elbows.',
    sample: repetition(pressStart, pressEnd),
    equipment: [...seat, [[82, 45], [82, 82]], [[187, 45], [187, 115], [64, 115]]],
    handles: (pose) => [[[187, 46], pose.arm[1]]],
  },
  leg_press_machine: {
    description: 'Keep your hips and back against the pad. Press through a comfortable range.',
    sample: repetition(legPressStart, legPressEnd),
    equipment: [[[56, 73], [108, 111], [130, 111]], [[79, 92], [78, 116]], [[140, 112], [215, 91]]],
    handles: ({ leg: [, [x, y]] }) => [[[x - 4, y + 15], [x + 11, y - 16]]],
  },
  low_row_machine: {
    description: 'On the low row machine, keep your torso supported or upright and pull the handles toward your waist.',
    sample: repetition(rowReach, rowPull),
    equipment: [...seat, [[105, 53], [108, 74]], [[108, 72], [169, 99]], [[156, 114], [196, 114], [196, 48]]],
    handles: (pose) => [[[190, 92], pose.arm[1]]],
  },
  lat_pulldown: {
    description: 'Pull the bar in front of you toward your upper chest and keep your torso steady.',
    sample: repetition(pulldownStart, pulldownEnd),
    equipment: [...seat, [[165, 116], [165, 9], [95, 9]], [[116, 80], [143, 80]]],
    handles: ({ arm: [, [x, y]] }) => [[[94, 9], [94, y]], [[x - 31, y], [x + 12, y]]],
  },
  plank: {
    description: 'Hold a comfortable neutral spine and breathe steadily. Use the knee-supported option if needed.',
    sample: (cycle) => cycle < 0.5 ? plank : kneePlank,
    equipment: [mat],
    static: true,
    alternatePoseLabel: 'Show knee plank',
  },
  bird_dog: {
    description: 'From hands and knees, extend opposite arm and leg without moving your trunk.',
    sample: repetition(quadruped, { ...quadruped, arm: [[65, 84], [42, 85]], farArm: quadruped.arm, farLeg: [[168, 86], [196, 87]] }),
    equipment: [mat],
  },
  glute_bridge: {
    description: 'With your feet planted, lift your hips comfortably and lower them with control.',
    sample: repetition(bridgeStart, bridgeEnd),
    equipment: [mat],
  },
  dead_bug: {
    description: 'Lower opposite arm and leg slowly. Keep your trunk steady and shorten the reach if needed.',
    sample: repetition(bugStart, bugReach),
    equipment: [mat],
  },
  gentle_cooldown: {
    description: 'Ease out with a relaxed walk and gentle stretches. The second pose shows a supported calf stretch.',
    sample: (cycle) => cycle < 0.5 ? walking(0.2) : calfStretch,
    handles: (pose) => pose === calfStretch ? [[[168, 112], [168, 43]]] : [],
    static: true,
    alternatePoseLabel: 'Show stretch',
  },
  optional_walk: {
    description: 'Walk at your own relaxed pace, with a natural arm swing.',
    sample: walking,
  },
};

function stroke(context: CanvasRenderingContext2D, points: Path, color: string, width: number) {
  const [first, ...rest] = points;
  if (!first) return;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

export function drawMovement(canvas: HTMLCanvasElement, guide: Guide, cycle: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const pose = guide.sample(cycle);
  const { head, shoulder, hip, arm, leg, farArm = arm, farLeg = leg } = pose;
  const ground = guide.ground ?? 119;
  context.setTransform(canvas.width / 256, 0, 0, canvas.height / 134, 0, 0);
  context.clearRect(0, 0, 256, 134);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  stroke(context, [[24, ground], [232, ground]], '#4e3b51', 2);
  for (const path of guide.equipment ?? []) stroke(context, path, '#876f8c', 4);
  for (const path of guide.handles?.(pose) ?? []) stroke(context, path, '#a78b9b', 4);

  stroke(context, [hip, ...farLeg], '#957890', 6);
  stroke(context, [shoulder, ...farArm], '#957890', 5);
  stroke(context, [shoulder, hip], '#c69eb7', 10);
  stroke(context, [hip, ...leg], '#e2c7ae', 7);
  stroke(context, [shoulder, ...arm], '#e2c7ae', 6);
  context.beginPath();
  context.arc(...head, 7, 0, 2 * Math.PI);
  context.fillStyle = '#e2c7ae';
  context.fill();
}
