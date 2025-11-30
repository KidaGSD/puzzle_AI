import React from 'react';
import { FragmentData } from '../types';
import { Cluster } from '../domain/models';

interface ClusterOverlayProps {
  clusters: Cluster[];
  fragments: FragmentData[];
}

export const ClusterOverlay: React.FC<ClusterOverlayProps> = ({ clusters, fragments }) => {
  const findFragment = (id: string) => fragments.find(f => f.id === id);

  return (
    <>
      {clusters.map(cluster => {
        const related = cluster.fragmentIds
          .map(findFragment)
          .filter(Boolean) as FragmentData[];
        if (related.length === 0) return null;
        const xs = related.map(f => f.position.x);
        const ys = related.map(f => f.position.y);
        const ws = related.map(f => f.size.width);
        const hs = related.map(f => f.size.height);

        const minX = Math.min(...xs) - 20;
        const minY = Math.min(...ys) - 20;
        const maxX = Math.max(...xs.map((x, i) => x + ws[i])) + 20;
        const maxY = Math.max(...ys.map((y, i) => y + hs[i])) + 20;
        const width = maxX - minX;
        const height = maxY - minY;

        return (
          <div
            key={cluster.id}
            className="absolute border-2 border-dashed border-amber-400/60 rounded-xl pointer-events-none bg-amber-100/10"
            style={{
              left: minX,
              top: minY,
              width,
              height,
            }}
          >
            <div className="absolute -top-6 left-0 px-2 py-1 bg-amber-400 text-amber-950 text-[11px] font-bold rounded-md shadow">
              {cluster.theme || 'Cluster'}
            </div>
          </div>
        );
      })}
    </>
  );
};
