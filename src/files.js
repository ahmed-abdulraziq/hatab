/** Saves a File through the browser's normal download. */
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True where the share sheet can send files (most phones): WhatsApp, Drive, email... */
export function canShareFiles() {
  try {
    const probe = new File(['{}'], 'hatab.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
