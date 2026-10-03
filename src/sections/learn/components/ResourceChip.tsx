import type { ComponentType } from 'react';
import type { ResourceKind } from '../../../api/types';
import { IcResAct, IcResImg, IcResLect, IcResVideo } from '../../../shared/components/icons';

const RES_ICON: Record<ResourceKind, ComponentType> = { video: IcResVideo, lect: IcResLect, imgr: IcResImg, act: IcResAct };
export function ResourceChip({ kind, label, onOpen }: { kind: ResourceKind; label: string; onOpen?: () => void }) {
  const I = RES_ICON[kind];
  return <button className={`rc ${kind}`} onClick={onOpen}><I />{label}</button>;
}
