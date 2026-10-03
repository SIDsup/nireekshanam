import { mapData } from '@/lib/data/lots-extra';
import { db } from '@/lib/data/store';
import { FarmMap, type ColourMode } from './farm-map';

export const metadata = { title: 'Farm map' };

export default async function MapPage({ searchParams }: { searchParams: Promise<{ lot?: string; colour?: string }> }) {
  const { lot, colour } = await searchParams;
  const data = mapData();
  const districts = [...new Set(db().villages.map((v) => v.districtName))].join(' & ');
  const initialMode: ColourMode = colour === 'compliance' || colour === 'crop' ? colour : 'stage';
  const initialLot = lot && data.farms.some((f) => f.lotId === lot) ? lot : null;

  return (
    <FarmMap
      data={data}
      eyebrow={`Kharif 2026 · ${districts} · ${data.farms.length.toLocaleString('en-IN')} farms`}
      initialMode={initialMode}
      initialLot={initialLot}
    />
  );
}
