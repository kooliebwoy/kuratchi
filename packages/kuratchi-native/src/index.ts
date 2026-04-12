export {
  showDesktopNotification,
  runDesktopCommand,
  startInteractiveCommand,
  writeInteractiveCommand,
  getInteractiveStatus,
  closeInteractiveCommand,
} from './runtime/desktop.js';
export type {
  DesktopNotificationPayload,
  DesktopCommandRequest,
  DesktopCommandResult,
  InteractiveCommandRequest,
  InteractiveStartResult,
  InteractiveWriteResult,
  InteractiveStatusResult,
  InteractiveCloseResult,
} from './runtime/desktop.js';
