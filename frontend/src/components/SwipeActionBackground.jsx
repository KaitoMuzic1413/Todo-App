import { motion, useTransform } from 'framer-motion';

const TONES = {
  danger: {
    surface: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600',
    chip: 'bg-white/25 ring-white/40 shadow-xs',
  },
  success: {
    surface: 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600',
    chip: 'bg-white/25 ring-white/40 shadow-xs',
  },
};

const SwipeActionBackground = ({ x, side, action, actionWidth = 92, onAction }) => {
  const isLeft = side === 'left';

  // Strictly increasing input ranges so Framer Motion clamps correctly
  const display = useTransform(x, (val) => {
    if (isLeft) return val > 1 ? 'flex' : 'none';
    return val < -1 ? 'flex' : 'none';
  });

  const opacity = useTransform(
    x,
    isLeft ? [0, 12, actionWidth] : [-actionWidth, -12, 0],
    isLeft ? [0, 1, 1] : [1, 1, 0],
    { clamp: true }
  );

  const iconScale = useTransform(
    x,
    isLeft ? [0, actionWidth * 0.5, actionWidth] : [-actionWidth, -actionWidth * 0.5, 0],
    isLeft ? [0.75, 1, 1.05] : [1.05, 1, 0.75],
    { clamp: true }
  );

  const labelY = useTransform(
    x,
    isLeft ? [0, actionWidth] : [-actionWidth, 0],
    isLeft ? [3, 0] : [0, 3],
    { clamp: true }
  );

  if (!action) return null;
  const Icon = action.icon;
  const tone = TONES[action.tone] || TONES.danger;

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onAction?.(action.key);
  };

  return (
    <motion.div
      className={`absolute inset-0 h-full w-full rounded-3xl ${tone.surface} items-center ${
        isLeft ? 'justify-start pl-2' : 'justify-end pr-2'
      }`}
      style={{ display, opacity }}
      onClick={handleClick}
    >
      <button
        type='button'
        aria-label={action.label}
        onClick={handleClick}
        style={{ width: actionWidth }}
        className='relative z-10 flex h-full shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 text-white outline-none'
      >
        <motion.span
          aria-hidden='true'
          style={{ scale: iconScale }}
          className={`relative flex h-10 w-10 items-center justify-center rounded-3xl text-white ring-1 backdrop-blur-xs ${tone.chip}`}
        >
          {Icon ? <Icon className='h-5 w-5 drop-shadow-sm' /> : null}
        </motion.span>
        <motion.span
          style={{ y: labelY }}
          className='relative text-[10px] font-black uppercase leading-tight tracking-wider text-white drop-shadow-sm'
        >
          {action.label}
        </motion.span>
      </button>
    </motion.div>
  );
};

export default SwipeActionBackground;
