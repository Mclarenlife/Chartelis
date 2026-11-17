export async function openDocumentWindow(parent, action = () => parent.keyboard.press('Control+n')) {
  await parent.locator('.editor-mount.is-ready').first().waitFor({ state: 'attached' });
  const opened = parent.waitForEvent('popup');
  await action();
  const child = await opened;
  await child.setViewportSize(parent.viewportSize());
  await child.locator('.editor-mount.is-ready').waitFor();
  return child;
}
