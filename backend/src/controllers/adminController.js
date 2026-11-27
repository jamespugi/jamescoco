import bcrypt from 'bcryptjs';
import {
  acceptAllPendingStaff,
  acceptPendingClientById,
  acceptPendingStaffById,
  archiveUserById,
  findAllNonAdminUsers,
  findAllUsers,
  createManagedUser,
  updateManagedUserById,
  setUserArchivedById,
  deleteUserById,
  findUserById,
  restoreArchivedUserById,
  sanitizeUser,
} from '../models/userModel.js';
import { isValidEmail, normalizeEmail, normalizePhoneNumber } from '../services/contactService.js';
import {
  findAllPaperUploads,
  findPaperUploadsByTraderId,
  findPaperUploadById,
  sanitizePaperUpload,
  updatePaperUploadStatus,
} from '../models/paperUploadModel.js';

export async function listClients(_req, res) {
  try {
    const clients = await findAllNonAdminUsers();
    return res.status(200).json({ clients: clients.map(sanitizeUser) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch clients.' });
  }
}

export async function listManagedUsers(_req, res) {
    try {
      const users = await findAllUsers();
      return res.status(200).json({ users: users.map(sanitizeUser) });
    } catch {
      return res.status(500).json({ error: 'Could not fetch accounts.' });
    }
  }

  export async function createManagedAccount(req, res) {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(String(req.body.email || '').trim());
    const phone = normalizePhoneNumber(req.body.phone);
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    const role = String(req.body.role || '').trim().toLowerCase();

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Full name, email, password, and confirm password are required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (String(req.body.phone || '').trim() && !phone) {
      return res.status(400).json({ error: 'Enter a valid phone number in international format.' });
    }
    if (!['admin', 'client', 'trader'].includes(role)) {
      return res.status(400).json({ error: 'Choose a supported account role.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and confirm password do not match.' });
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.' });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = await createManagedUser({
        fullName,
        email,
        phone,
        passwordHash,
        role,
      });
      const user = await findUserById(userId);
      return res.status(201).json({
        message: `${role === 'admin' ? 'Admin' : role === 'trader' ? 'Trader' : 'Client'} account created successfully.`,
        user: sanitizeUser(user),
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email or phone number already exists.' });
      }
      return res.status(500).json({ error: 'Could not create account.' });
    }
  }

  export async function updateManagedAccount(req, res) {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid account ID.' });
    }

    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(String(req.body.email || '').trim());
    const phone = normalizePhoneNumber(req.body.phone);
    const role = String(req.body.role || '').trim().toLowerCase();

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (String(req.body.phone || '').trim() && !phone) {
      return res.status(400).json({ error: 'Enter a valid phone number in international format.' });
    }
    if (!['admin', 'client', 'trader'].includes(role)) {
      return res.status(400).json({ error: 'Choose a supported account role.' });
    }
    if (targetId === Number(req.auth.id) && role !== 'admin') {
      return res.status(403).json({ error: 'You cannot demote or remove your own admin account.' });
    }

    try {
      const existing = await findUserById(targetId);
      if (!existing) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      const affectedRows = await updateManagedUserById(targetId, { fullName, email, phone, role });
      if (!affectedRows) {
        return res.status(404).json({ error: 'Account not found or archived.' });
      }
      const user = await findUserById(targetId);
      return res.status(200).json({ message: 'Account updated successfully.', user: sanitizeUser(user) });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email or phone number already exists.' });
      }
      return res.status(500).json({ error: 'Could not update account.' });
    }
  }

  export async function setManagedAccountActive(req, res) {
    const targetId = Number(req.params.id);
    const active = String(req.body.active) === 'true';
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid account ID.' });
    }
    if (targetId === Number(req.auth.id)) {
      return res.status(403).json({ error: 'You cannot deactivate or activate your own account.' });
    }

    try {
      const affectedRows = await setUserArchivedById(targetId, !active);
      if (!affectedRows) {
        return res.status(404).json({ error: 'Account not found.' });
      }
      return res.status(200).json({ message: active ? 'Account activated successfully.' : 'Account deactivated successfully.' });
    } catch {
      return res.status(500).json({ error: 'Could not update account status.' });
    }
  }

  export async function deleteManagedAccount(req, res) {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid account ID.' });
    }
    if (targetId === Number(req.auth.id)) {
      return res.status(403).json({ error: 'You cannot remove your own admin account.' });
    }

    try {
      const affectedRows = await deleteUserById(targetId);
      if (!affectedRows) {
        return res.status(404).json({ error: 'Account not found or already removed.' });
      }
      return res.status(200).json({ message: 'Account removed successfully.' });
    } catch {
      return res.status(500).json({ error: 'Could not remove account.' });
    }
  }

export async function acceptClient(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await acceptPendingClientById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Pending client not found.' });
    }

    return res.status(200).json({ message: 'Client accepted successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not update client status.' });
  }
}

export async function acceptStaff(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await acceptPendingStaffById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Pending staff request not found.' });
    }

    return res.status(200).json({ message: 'Client promoted to staff.' });
  } catch {
    return res.status(500).json({ error: 'Could not approve staff request.' });
  }
}

export async function acceptAllStaff(req, res) {
  try {
    const updatedCount = await acceptAllPendingStaff();
    return res.status(200).json({
      message: updatedCount
        ? `Accepted ${updatedCount} staff application${updatedCount > 1 ? 's' : ''}.`
        : 'No pending staff applications found.',
      updatedCount,
    });
  } catch {
    return res.status(500).json({ error: 'Could not approve all staff requests.' });
  }
}

export async function getClientDetails(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const user = await findUserById(targetId);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ error: 'User not found.' });
    }

    const uploads = await findPaperUploadsByTraderId(targetId);

    return res.status(200).json({
      user: sanitizeUser(user),
      documents: uploads.map(sanitizePaperUpload),
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch user details.' });
  }
}

export async function archiveClient(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await archiveUserById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'User not found or already archived.' });
    }

    return res.status(200).json({ message: 'User archived successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not archive user.' });
  }
}

export async function restoreClient(req, res) {
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid client ID.' });
  }

  try {
    const affectedRows = await restoreArchivedUserById(targetId);
    if (!affectedRows) {
      return res.status(404).json({ error: 'Archived user not found.' });
    }

    return res.status(200).json({ message: 'User restored successfully.' });
  } catch {
    return res.status(500).json({ error: 'Could not restore user.' });
  }
}

export async function listPaperUploads(_req, res) {
  try {
    const rows = await findAllPaperUploads();
    return res.status(200).json({ uploads: rows.map(sanitizePaperUpload) });
  } catch {
    return res.status(500).json({ error: 'Could not fetch paper uploads.' });
  }
}

export async function reviewPaperUpload(req, res) {
  const uploadId = Number(req.params.id);
  const status = String(req.body?.status || '').trim().toLowerCase();
  const reviewNotes = String(req.body?.reviewNotes || '').trim();

  if (!Number.isInteger(uploadId) || uploadId <= 0) {
    return res.status(400).json({ error: 'Invalid upload ID.' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected.' });
  }

  try {
    const existing = await findPaperUploadById(uploadId);
    if (!existing) {
      return res.status(404).json({ error: 'Paper upload not found.' });
    }

    const affectedRows = await updatePaperUploadStatus(uploadId, {
      status,
      reviewNotes,
      reviewedBy: req.auth.id,
    });

    if (!affectedRows) {
      return res.status(404).json({ error: 'Paper upload not found.' });
    }

    return res.status(200).json({
      message: `Paper upload ${status} successfully.`,
    });
  } catch {
    return res.status(500).json({ error: 'Could not update paper upload status.' });
  }
}
