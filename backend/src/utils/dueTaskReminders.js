import Task from '../models/Task.js';
import { sendEmail } from './email.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const formatDueDate = (date, timeZone, language) => {
  let validTimeZone = timeZone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: validTimeZone }).format(date);
  } catch {
    validTimeZone = 'UTC';
  }
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: validTimeZone,
  }).format(date);
};

export const runDueTaskEmailReminders = async (now = new Date()) => {
  try {
    const upperBound = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueTasks = await Task.find({
      isDeleted: false,
      status: 'active',
      dueAt: { $gt: now, $lte: upperBound },
      dueEmailReminderSentFor: null,
      $or: [{ contentType: 'task' }, { contentType: { $exists: false } }],
    }).populate('userId', 'email preferences.language').limit(100);

    let sent = 0;
    for (const task of dueTasks) {
      if (!task.userId?.email) continue;

      // Claim this schedule before sending so concurrent server instances do not email twice.
      const claim = await Task.findOneAndUpdate(
        { _id: task._id, dueAt: task.dueAt, dueEmailReminderSentFor: null, status: 'active', isDeleted: false },
        { $set: { dueEmailReminderSentFor: task.dueAt } },
        { returnDocument: 'after' }
      );
      if (!claim) continue;

      const language = task.userId.preferences?.language === 'vi' ? 'vi' : 'en';
      const title = escapeHtml(task.title);
      const dueDate = escapeHtml(formatDueDate(task.dueAt, task.timeZone, language));
      const frontendUrl = process.env.FRONTEND_URL || 'https://todo-app-kaito20.vercel.app';
      const subject = language === 'vi' ? `Nhắc hạn công việc: ${task.title}` : `Task due within 24 hours: ${task.title}`;
      const html = language === 'vi'
        ? `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b"><h2>Công việc sắp đến hạn</h2><p><strong>${title}</strong></p><p>Hạn hoàn thành: ${dueDate}</p><p>Công việc sẽ đến hạn trong vòng 24 giờ tới.</p><p><a href="${frontendUrl}/calendar">Mở lịch</a></p></div>`
        : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b"><h2>Task due soon</h2><p><strong>${title}</strong></p><p>Due: ${dueDate}</p><p>This task is due within the next 24 hours.</p><p><a href="${frontendUrl}/calendar">Open calendar</a></p></div>`;

      try {
        await sendEmail({ to: task.userId.email, subject, html });
        sent += 1;
      } catch (error) {
        await Task.updateOne(
          { _id: task._id, dueAt: task.dueAt, dueEmailReminderSentFor: task.dueAt },
          { $set: { dueEmailReminderSentFor: null } }
        );
        console.error(`Could not send due reminder for task ${task._id}:`, error);
      }
    }

    return sent;
  } catch (error) {
    console.error('Could not process scheduled task reminder emails:', error);
    return 0;
  }
};
