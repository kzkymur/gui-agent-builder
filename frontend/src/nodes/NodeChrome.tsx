import React from 'react';

type Props = {
  title: string;
  children?: React.ReactNode; // body/content
  handles?: React.ReactNode; // area rendered below body
  kind?: string;
  style?: React.CSSProperties;
};

export default function NodeChrome({ title, children, handles, kind, style }: Props) {
  const cls = kind ? `node node--${kind}` : 'node';
  return (
    <div className={cls} style={style}>
      <div className="node__title">{title}</div>
      <div className="node__body">{children}</div>
      {handles ? <div className="node__handles">{handles}</div> : null}
    </div>
  );
}
