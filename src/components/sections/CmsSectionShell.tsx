import React from 'react';
import { motion } from 'motion/react';
import type { HomepageSection, HomepageSectionAnimation } from '../../types';

const motionFor = (animation?: HomepageSectionAnimation | string) => {
  switch (animation) {
    case 'slide_up':
      return { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 } };
    case 'scale':
      return { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 } };
    case 'none':
      return { initial: { opacity: 1 }, animate: { opacity: 1 } };
    case 'fade':
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
  }
};

type Props = {
  section?: HomepageSection | null;
  className?: string;
  children: React.ReactNode;
};

/** Progressive reveal wrapper — fade / slide_up / scale from CMS animation field. */
export const CmsSectionShell: React.FC<Props> = ({ section, className, children }) => {
  const m = motionFor(section?.animation);
  return (
    <motion.div
      className={className}
      initial={m.initial}
      whileInView={m.animate}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{
        backgroundColor: section?.backgroundColor || undefined,
        color: section?.textColor || undefined,
      }}
    >
      {children}
    </motion.div>
  );
};
