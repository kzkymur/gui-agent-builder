import React from 'react';
import { Handle, Position } from 'reactflow';
import type { RFNodeProps, LLMData } from '../types';
import NodeChrome from './NodeChrome';

export default function LLMNode({ data }: RFNodeProps<LLMData>) {
  const outs = (data.outputPointers && data.outputPointers.length > 0) ? data.outputPointers : ['/result'];
  return (
    <NodeChrome
      title={data.name ?? 'LLM'}
      kind="llm"
      handles={
        <>
          <div className="node__handles-left">
            <Handle type="target" position={Position.Left} />
          </div>
          <div className="node__handles-right">
            {outs.map((_, idx) => (
              <Handle key={`out-${idx}`} id={`out-${idx}`} type="source" position={Position.Right} />
            ))}
          </div>
        </>
      }
    >
      <div className="kvs">
        <div className="kv"><span>Provider</span><code>{data.provider}</code></div>
        <div className="kv"><span>Model</span><code>{data.model}</code></div>
        <div className="kv"><span>Schema</span><code>{data.responseSchema ? 'defined' : '—'}</code></div>
      </div>
    </NodeChrome>
  );
}
