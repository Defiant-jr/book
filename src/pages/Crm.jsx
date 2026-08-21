import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FolderOpen,
  FolderPlus,
  LayoutDashboard,
  Languages,
  Loader2,
  Eye,
  MoveRight,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const GOOGLE_DRIVE_ROOT_FOLDER_ID = '1VmyjEz2hO1XJi9J7Ysi_wjYPzI7eLmE0';
const GOOGLE_DRIVE_ROOT_FOLDER_URL =
  `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_ROOT_FOLDER_ID}?hl=pt-br`;

const formatFileSize = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatModifiedDate = (value) =>
  value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

const getPreviewUrl = (file) => {
  const encodedId = encodeURIComponent(file.id);
  const googlePreviewPaths = {
    'application/vnd.google-apps.document': `https://docs.google.com/document/d/${encodedId}/preview`,
    'application/vnd.google-apps.spreadsheet': `https://docs.google.com/spreadsheets/d/${encodedId}/preview`,
    'application/vnd.google-apps.presentation': `https://docs.google.com/presentation/d/${encodedId}/preview`,
  };

  return googlePreviewPaths[file.mimeType] || `https://drive.google.com/file/d/${encodedId}/preview`;
};

const Crm = () => {
  const CRM_DASHBOARD_REF = 50000;
  const CRM_DRIVE_REF = 51000;
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const driveFilesLoadedRef = useRef(false);
  const isDrive = location.pathname === '/crm/drive';
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveFolderStack, setMoveFolderStack] = useState([
    { id: GOOGLE_DRIVE_ROOT_FOLDER_ID, name: 'CRM' },
  ]);
  const [moveFolders, setMoveFolders] = useState([]);
  const [isLoadingMoveFolders, setIsLoadingMoveFolders] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [folderStack, setFolderStack] = useState([
    {
      id: GOOGLE_DRIVE_ROOT_FOLDER_ID,
      name: 'CRM',
      webViewLink: GOOGLE_DRIVE_ROOT_FOLDER_URL,
    },
  ]);
  const currentFolder = folderStack[folderStack.length - 1];

  const navButtons = [
    { label: 'DASHBOARD', path: '/crm', icon: LayoutDashboard },
    { label: 'Drive Jrnotes', path: '/crm/drive', icon: FolderOpen },
    { label: 'Tradutor', path: '/crm/tradutor', icon: Languages },
  ];

  const loadFiles = useCallback(async (folderId = GOOGLE_DRIVE_ROOT_FOLDER_ID) => {
    setIsLoadingFiles(true);
    setDriveError('');

    try {
      const params = new URLSearchParams({ folderId });
      const response = await fetch(`/api/google-drive/files?${params}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível carregar os arquivos.');
      }

      setFiles(payload.files || []);
      setSelectedFileId((current) =>
        payload.files?.some((file) => file.id === current) ? current : ''
      );
      return true;
    } catch (error) {
      setDriveError(error.message || 'Não foi possível carregar os arquivos.');
      return false;
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (isDrive && !driveFilesLoadedRef.current) {
      driveFilesLoadedRef.current = true;
      loadFiles();
    }
  }, [isDrive, loadFiles]);

  useEffect(() => {
    if (!previewFile) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPreviewFile(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile]);

  const handleUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of selectedFiles) {
        const response = await fetch('/api/google-drive/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name),
            'X-File-Type': file.type || 'application/octet-stream',
            'X-Parent-Folder-Id': currentFolder.id,
          },
          body: file,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || `Não foi possível enviar ${file.name}.`);
        }
      }

      toast({
        title: 'Upload concluído',
        description: `${selectedFiles.length} arquivo(s) enviado(s) ao Google Drive.`,
      });
      await loadFiles(currentFolder.id);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar os arquivos.',
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const selectedFile = files.find((file) => file.id === selectedFileId);
  const selectedFileIsFolder = selectedFile?.mimeType === 'application/vnd.google-apps.folder';

  const handleCreateFolder = async () => {
    const name = folderName.trim();
    if (!name) return;

    setIsCreatingFolder(true);
    try {
      const response = await fetch('/api/google-drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: currentFolder.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível criar a pasta.');
      }

      toast({
        title: 'Pasta criada',
        description: `A pasta “${name}” foi criada no Google Drive.`,
      });
      setFiles((current) =>
        [...current, payload.folder].sort((a, b) => {
          const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
          const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
          if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt-BR');
        })
      );
      setSelectedFileId(payload.folder.id);
      setFolderName('');
      setIsFolderDialogOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar pasta',
        description: error.message || 'Não foi possível criar a pasta.',
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile || selectedFileIsFolder) return;

    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/google-drive/files/${encodeURIComponent(selectedFile.id)}/download`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Não foi possível baixar o arquivo.');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const encodedName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const downloadName = encodedName ? decodeURIComponent(encodedName) : selectedFile.name;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no download',
        description: error.message || 'Não foi possível baixar o arquivo.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/google-drive/files/${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível excluir o item.');
      }

      setFiles((current) => current.filter((file) => file.id !== deleteTarget.id));
      setSelectedFileId('');
      toast({
        title: deleteTarget.mimeType === 'application/vnd.google-apps.folder'
          ? 'Pasta excluída'
          : 'Arquivo excluído',
        description: `“${deleteTarget.name}” foi enviado para a lixeira do Google Drive.`,
      });
      setDeleteTarget(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir o item.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const loadMoveFolders = async (folderId) => {
    setIsLoadingMoveFolders(true);
    try {
      const params = new URLSearchParams({ folderId });
      const response = await fetch(`/api/google-drive/files?${params}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível carregar as pastas.');
      }
      setMoveFolders(
        (payload.files || []).filter(
          (file) => file.mimeType === 'application/vnd.google-apps.folder'
        )
      );
      return true;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar pastas',
        description: error.message || 'Não foi possível carregar as pastas.',
      });
      return false;
    } finally {
      setIsLoadingMoveFolders(false);
    }
  };

  const handleOpenMoveDialog = async () => {
    if (!selectedFile) return;
    setMoveTarget(selectedFile);
    setMoveFolders([]);
    setMoveFolderStack([{ id: GOOGLE_DRIVE_ROOT_FOLDER_ID, name: 'CRM' }]);
    await loadMoveFolders(GOOGLE_DRIVE_ROOT_FOLDER_ID);
  };

  const handleOpenMoveFolder = async (folder) => {
    const loaded = await loadMoveFolders(folder.id);
    if (!loaded) return;
    setMoveFolderStack((current) => [...current, { id: folder.id, name: folder.name }]);
  };

  const handleMoveFolderBack = async () => {
    if (moveFolderStack.length <= 1) return;
    const destination = moveFolderStack[moveFolderStack.length - 2];
    const loaded = await loadMoveFolders(destination.id);
    if (!loaded) return;
    setMoveFolderStack((current) => current.slice(0, -1));
  };

  const handleMoveFolderBreadcrumb = async (index) => {
    if (index === moveFolderStack.length - 1) return;
    const destination = moveFolderStack[index];
    const loaded = await loadMoveFolders(destination.id);
    if (!loaded) return;
    setMoveFolderStack((current) => current.slice(0, index + 1));
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    const destination = moveFolderStack[moveFolderStack.length - 1];

    setIsMoving(true);
    try {
      const response = await fetch(
        `/api/google-drive/files/${encodeURIComponent(moveTarget.id)}/move`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationFolderId: destination.id }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível mover o item.');
      }

      setFiles((current) => current.filter((file) => file.id !== moveTarget.id));
      setSelectedFileId('');
      toast({
        title: 'Item movido',
        description: `“${moveTarget.name}” foi movido para “${destination.name}”.`,
      });
      setMoveTarget(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao mover',
        description: error.message || 'Não foi possível mover o item.',
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleOpenFolder = async (folder) => {
    const loaded = await loadFiles(folder.id);
    if (!loaded) return;

    setFolderStack((current) => [
      ...current,
      {
        id: folder.id,
        name: folder.name,
        webViewLink:
          folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}?hl=pt-br`,
      },
    ]);
    setSelectedFileId('');
  };

  const handleNavigateToFolder = async (index) => {
    if (index === folderStack.length - 1) return;
    const destination = folderStack[index];
    const loaded = await loadFiles(destination.id);
    if (!loaded) return;

    setFolderStack((current) => current.slice(0, index + 1));
    setSelectedFileId('');
  };

  const handleGoBackFolder = () => {
    if (folderStack.length > 1) {
      handleNavigateToFolder(folderStack.length - 2);
    }
  };

  return (
    <div className="space-y-8">
      <Helmet>
        <title>{isDrive ? 'Drive Jrnotes' : 'CRM'} - BooK+</title>
        <meta name="description" content="Área de relacionamento com clientes e gestão comercial" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="text-left">
            <h1 className="text-3xl font-bold gradient-text">
              {isDrive ? 'Drive Jrnotes' : 'CRM'}
            </h1>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {isDrive ? CRM_DRIVE_REF : CRM_DASHBOARD_REF}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-card p-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {navButtons.map((item, index) => {
              const Icon = item.icon;

              return (
                <Button
                  key={index}
                  onClick={() => navigate(item.path)}
                  variant="ghost"
                  className="flex-grow sm:flex-grow-0 text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {isDrive && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Arquivos do Drive Jrnotes</h2>
                <p className="text-sm text-gray-400">
                  Conteúdo da pasta compartilhada do CRM.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => setIsFolderDialogOpen(true)}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Nova pasta
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={!selectedFile || selectedFileIsFolder || isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPreviewFile(selectedFile)}
                  disabled={!selectedFile || selectedFileIsFolder}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget(selectedFile)}
                  disabled={!selectedFile}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenMoveDialog}
                  disabled={!selectedFile}
                >
                  <MoveRight className="mr-2 h-4 w-4" />
                  Mover
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => loadFiles(currentFolder.id)}
                  disabled={isLoadingFiles}
                  title="Atualizar arquivos"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  <span className="sr-only">Atualizar arquivos</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    window.open(
                      currentFolder.webViewLink ||
                        `https://drive.google.com/drive/folders/${currentFolder.id}?hl=pt-br`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                  title="Abrir no Google Drive"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Abrir no Google Drive</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleGoBackFolder}
                disabled={folderStack.length === 1 || isLoadingFiles}
                title="Voltar para a pasta anterior"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Voltar para a pasta anterior</span>
              </Button>
              <div className="flex min-w-max items-center text-sm">
                {folderStack.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    {index > 0 && <ChevronRight className="mx-1 h-4 w-4 text-gray-500" />}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        index === folderStack.length - 1
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white'
                      }
                      onClick={() => handleNavigateToFolder(index)}
                      disabled={isLoadingFiles}
                    >
                      {folder.name}
                    </Button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {driveError ? (
              <div className="p-6 text-center">
                <p className="text-red-300">{driveError}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => loadFiles(currentFolder.id)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : isLoadingFiles && files.length === 0 ? (
              <div className="flex min-h-56 items-center justify-center text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Carregando arquivos...
              </div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Nenhum arquivo encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="w-12 px-4 py-3" aria-label="Selecionar" />
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Tamanho</th>
                      <th className="px-4 py-3">Modificado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      const Icon = isFolder ? FolderOpen : File;

                      return (
                        <tr
                          key={file.id}
                          className={`cursor-pointer border-b border-white/5 text-gray-300 hover:bg-white/5 ${
                            selectedFileId === file.id ? 'bg-white/5' : ''
                          }`}
                          onClick={() => setSelectedFileId(file.id)}
                          onDoubleClick={() => {
                            if (isFolder) {
                              handleOpenFolder(file);
                            } else {
                              setPreviewFile(file);
                            }
                          }}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="radio"
                              name="drive-file"
                              checked={selectedFileId === file.id}
                              onChange={() => setSelectedFileId(file.id)}
                              aria-label={`Selecionar ${file.name}`}
                              className="h-4 w-4 accent-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 shrink-0 text-blue-300" />
                              <span className="font-medium text-white">{file.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{isFolder ? 'Pasta' : formatFileSize(file.size)}</td>
                          <td className="px-4 py-3 text-sm">{formatModifiedDate(file.modifiedTime)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização de ${previewFile.name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewFile(null);
          }}
        >
          <Card className="glass-card flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 p-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-white">{previewFile.name}</h2>
                <p className="text-sm text-gray-400">Visualização do Google Drive</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    window.open(previewFile.webViewLink, '_blank', 'noopener,noreferrer')
                  }
                  title="Abrir no Google Drive"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Abrir no Google Drive</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPreviewFile(null)}
                  title="Fechar visualização"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fechar visualização</span>
                </Button>
              </div>
            </div>
            <iframe
              title={`Visualização de ${previewFile.name}`}
              src={getPreviewUrl(previewFile)}
              className="min-h-0 flex-1 border-0 bg-white"
              allow="autoplay"
            />
          </Card>
        </div>
      )}

      {isFolderDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-folder-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isCreatingFolder) {
              setIsFolderDialogOpen(false);
            }
          }}
        >
          <Card className="glass-card w-full max-w-md p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="new-folder-title" className="text-xl font-semibold text-white">
                Criar nova pasta
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFolderDialogOpen(false)}
                disabled={isCreatingFolder}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="drive-folder-name" className="text-sm font-medium text-gray-200">
                  Nome da pasta
                </label>
                <input
                  id="drive-folder-name"
                  type="text"
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && folderName.trim() && !isCreatingFolder) {
                      event.preventDefault();
                      handleCreateFolder();
                    }
                  }}
                  placeholder="Digite o nome da pasta"
                  autoFocus
                  maxLength={200}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-gray-500 focus:border-blue-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFolderDialogOpen(false)}
                  disabled={isCreatingFolder}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!folderName.trim() || isCreatingFolder}
                >
                  {isCreatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar pasta
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-drive-item-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <Card className="glass-card w-full max-w-md p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-drive-item-title" className="text-xl font-semibold text-white">
                  Excluir {deleteTarget.mimeType === 'application/vnd.google-apps.folder'
                    ? 'pasta'
                    : 'arquivo'}
                </h2>
                <p className="mt-2 text-sm text-gray-300">
                  Confirma o envio de <strong>“{deleteTarget.name}”</strong> para a lixeira do
                  Google Drive?
                </p>
                {deleteTarget.mimeType === 'application/vnd.google-apps.folder' && (
                  <p className="mt-2 text-sm text-yellow-200">
                    Todo o conteúdo dentro desta pasta também ficará na lixeira.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Excluir
              </Button>
            </div>
          </Card>
        </div>
      )}

      {moveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-drive-item-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isMoving) {
              setMoveTarget(null);
            }
          }}
        >
          <Card className="glass-card flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h2 id="move-drive-item-title" className="text-xl font-semibold text-white">
                  Mover “{moveTarget.name}”
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Navegue até a pasta de destino e confirme a movimentação.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMoveTarget(null)}
                disabled={isMoving}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleMoveFolderBack}
                disabled={moveFolderStack.length === 1 || isLoadingMoveFolders || isMoving}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Voltar</span>
              </Button>
              <div className="flex min-w-max items-center text-sm">
                {moveFolderStack.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    {index > 0 && <ChevronRight className="mx-1 h-4 w-4 text-gray-500" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={
                        index === moveFolderStack.length - 1
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white'
                      }
                      onClick={() => handleMoveFolderBreadcrumb(index)}
                      disabled={isLoadingMoveFolders || isMoving}
                    >
                      {folder.name}
                    </Button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="min-h-48 flex-1 overflow-y-auto p-3">
              {isLoadingMoveFolders ? (
                <div className="flex min-h-40 items-center justify-center text-gray-400">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Carregando pastas...
                </div>
              ) : moveFolders.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center text-gray-400">
                  Esta pasta não possui subpastas.
                </div>
              ) : (
                <div className="space-y-1">
                  {moveFolders
                    .filter((folder) => folder.id !== moveTarget.id)
                    .map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-gray-200 hover:bg-white/10"
                      onClick={() => handleOpenMoveFolder(folder)}
                      disabled={isMoving}
                    >
                      <FolderOpen className="h-5 w-5 shrink-0 text-blue-300" />
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                    </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-400">
                Destino: <strong className="text-white">
                  {moveFolderStack[moveFolderStack.length - 1].name}
                </strong>
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMoveTarget(null)}
                  disabled={isMoving}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={
                    isMoving ||
                    isLoadingMoveFolders ||
                    moveFolderStack[moveFolderStack.length - 1].id === currentFolder.id
                  }
                >
                  {isMoving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MoveRight className="mr-2 h-4 w-4" />
                  )}
                  Mover para esta pasta
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Crm;
