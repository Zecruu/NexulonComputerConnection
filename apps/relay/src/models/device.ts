import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice extends Document {
  deviceId: string;         // 6-char alphanumeric (e.g. "ABC123")
  name: string;             // Friendly name (e.g. "Front Desk PC")
  online: boolean;          // Currently connected to relay
  needsHelp: boolean;       // Customer toggled "Need Help"
  assignedTo: string | null; // Clerk userId of the agent who claimed this device
  assignedEmail: string | null; // Agent's email for display
  lastSeen: Date;
  os: string;               // win32 | darwin | linux
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
    },
    online: {
      type: Boolean,
      default: false,
    },
    needsHelp: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: String,
      default: null,
      index: true,
    },
    assignedEmail: {
      type: String,
      default: null,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    os: {
      type: String,
      default: 'unknown',
    },
  },
  { timestamps: true }
);

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);
