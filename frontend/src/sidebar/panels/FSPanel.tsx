import { Button, Text, TextField, TextArea } from "@radix-ui/themes";
import React from "react";
import { VFS, type VfsEntry } from "../../fs/vfs";
import type { NodeData, FSData } from "../../types";
import { useEngineStore } from "../../engine/store";

export default function FSPanel({
  draft,
  onPatch,
}: {
  draft: FSData & NodeData;
  onPatch: (p: Partial<NodeData>) => void;
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const [cwd, setCwd] = React.useState<string>("/");
  const [list, setList] = React.useState<VfsEntry[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [content, setContent] = React.useState<string>("");
  const [showNew, setShowNew] = React.useState(false);
  const [newRelPath, setNewRelPath] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [showRename, setShowRename] = React.useState(false);
  const [renameBase, setRenameBase] = React.useState("");

  const refresh = React.useCallback(async () => {
    try {
      setList(await VFS.listDirectory(cwd));
    } catch {
      setList([]);
    }
  }, [cwd]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (path: string, type: VfsEntry["type"]) => {
    if (type === "dir") {
      setCwd(path);
      setSelected("");
      setContent("");
    } else {
      setSelected(path);
      try {
        setContent(await VFS.readFile(path));
      } catch {
        setContent("");
      }
    }
  };

  const save = async () => {
    if (!selected) return;
    await VFS.writeFile(selected, content);
    await refresh();
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm(`Delete file ${selected}?`)) return;
    await VFS.deleteFile(selected);
    setSelected("");
    setContent("");
    await refresh();
  };

  const pathJoin = (a: string, b: string) => {
    if (!b) return a;
    if (a === "/") return `/${b.replace(/^\/+/, "")}`;
    return `${a.replace(/\/+$/, "")}/${b.replace(/^\/+/, "")}`;
  };

  const createNew = async () => {
    const rel = newRelPath.trim();
    if (!rel) return;
    const full = pathJoin(cwd, rel);
    await VFS.writeFile(full, "");
    setShowNew(false);
    setNewRelPath("");
    await refresh();
    await open(full, "file");
  };

  const onUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      try {
        const text = await f.text();
        const full = pathJoin(cwd, f.name);
        await VFS.writeFile(full, text);
      } catch {
        // ignore per-file errors
      }
    }
    await refresh();
  };

  const parentDir = React.useMemo(() => {
    if (!selected) return cwd;
    const idx = selected.lastIndexOf("/");
    return idx <= 0 ? "/" : selected.slice(0, idx);
  }, [selected, cwd]);

  const baseName = React.useMemo(() => {
    if (!selected) return "";
    const idx = selected.lastIndexOf("/");
    return idx < 0 ? selected : selected.slice(idx + 1);
  }, [selected]);

  const doRename = async () => {
    const next = renameBase.trim();
    if (!selected || !next) return;
    const nextPath = parentDir === "/" ? `/${next}` : `${parentDir}/${next}`;
    await VFS.renameFile(selected, nextPath);
    setSelected(nextPath);
    setShowRename(false);
    await refresh();
  };

  return (
    <>
      <div className="field">
        <Text as="span" weight="medium">
          Filesystem
        </Text>
        <div style={{ display: "flex", gap: 8 }}>
          <TextField.Root
            value={cwd}
            onChange={(e) => setCwd((e.target as HTMLInputElement).value)}
            disabled={isBusy}
          />
          <Button size="1" onClick={() => refresh()} disabled={isBusy}>
            List
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={() => setShowNew((v) => !v)}
            disabled={isBusy}
          >
            New File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => onUploadFiles(e.currentTarget.files)}
          />
          <Button
            size="1"
            variant="soft"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            Upload…
          </Button>
        </div>
        <div className="help">Explore virtual files and edit content.</div>
      </div>
      {showNew && (
        <div className="field">
          <Text as="span" weight="medium">
            Create New File
          </Text>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ color: "var(--gray-11)" }}>
              {cwd === "/" ? "" : cwd}/
            </code>
            <TextField.Root
              placeholder="relative/path.txt"
              value={newRelPath}
              onChange={(e) =>
                setNewRelPath((e.target as HTMLInputElement).value)
              }
              disabled={isBusy}
              style={{ flex: 1 }}
            />
            <Button
              size="1"
              onClick={createNew}
              disabled={isBusy || !newRelPath.trim()}
            >
              Create
            </Button>
            <Button
              size="1"
              variant="ghost"
              color="red"
              onClick={() => {
                setShowNew(false);
                setNewRelPath("");
              }}
              disabled={isBusy}
            >
              Cancel
            </Button>
          </div>
          <div className="help">
            File is created empty; edit below and Save.
          </div>
        </div>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {list.map((e) => (
          <div
            key={e.path}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              style={{
                all: "unset",
                cursor: "pointer",
                color: e.type === "dir" ? "var(--gray-12)" : "var(--blue-11)",
              }}
              onClick={() => open(e.path, e.type)}
            >
              {e.type === "dir" ? "📁" : "📄"} {e.path}
            </button>
            {e.type === "file" && (
              <span style={{ color: "var(--gray-11)", fontSize: 12 }}>
                {e.size ?? 0} B
              </span>
            )}
          </div>
        ))}
        {selected && (
          <div className="field">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "space-between",
                height: "32px",
              }}
            >
              <Text as="span" weight="medium">
                {selected}
              </Text>
              {!showRename ? (
                <Button
                  size="1"
                  variant="soft"
                  onClick={() => {
                    setRenameBase(baseName);
                    setShowRename(true);
                  }}
                  disabled={isBusy}
                >
                  Rename
                </Button>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <code style={{ color: "var(--gray-11)" }}>
                    {parentDir === "/" ? "" : parentDir}/
                  </code>
                  <TextField.Root
                    value={renameBase}
                    onChange={(e) =>
                      setRenameBase((e.target as HTMLInputElement).value)
                    }
                    disabled={isBusy}
                  />
                  <Button
                    size="1"
                    onClick={doRename}
                    disabled={isBusy || !renameBase.trim()}
                  >
                    Apply
                  </Button>
                  <Button
                    size="1"
                    variant="ghost"
                    color="red"
                    onClick={() => setShowRename(false)}
                    disabled={isBusy}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <TextArea
              className="mono"
              rows={8}
              style={{ resize: "vertical" }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isBusy}
            />
            <div>
              <Button onClick={save} disabled={isBusy}>
                Save
              </Button>
              <Button
                color="red"
                variant="soft"
                style={{ marginLeft: 8 }}
                onClick={remove}
                disabled={isBusy}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
