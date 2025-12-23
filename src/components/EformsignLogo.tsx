import React from 'react';

export const EformsignLogo: React.FC<{ style?: React.CSSProperties; className?: string }> = ({
  style,
  className,
}) => (
  <img
    src="/eformsign-logo.png"
    alt="eformsign 로고"
    width={234}
    height={55}
    style={{ ...style }}
    className={className}
  />
);
