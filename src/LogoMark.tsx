import { useState } from 'react';
import enjazLogo from '../refImages/EnjazLogo.png';

const ENJAZ_LOGO_SRC = enjazLogo;

export function LogoMark({ sizeClass = 'w-10 h-10' }: { sizeClass?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`${sizeClass} rounded-md bg-[#151d5d] flex items-center justify-center`}>
        <span className="text-white text-[9px] font-extrabold tracking-widest">ENJAZ</span>
      </div>
    );
  }
  return (
    <img
      src={ENJAZ_LOGO_SRC}
      alt="Enjaz logo"
      className={`${sizeClass} rounded-md object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
