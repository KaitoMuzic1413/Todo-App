export const deleteGridFsFileIfExists = async (bucket, fileId) => {
  const cursor = bucket.find({ _id: fileId });
  if (!await cursor.hasNext()) return false;
  await bucket.delete(fileId);
  return true;
};

export const deleteGridFsFilesSafely = async (files, deleteFile) => {
  const deletedIds = [];
  const failures = [];

  for (const file of files) {
    try {
      await deleteFile(file.fileId);
      deletedIds.push(file._id);
    } catch (error) {
      failures.push({ id: file._id, error });
    }
  }

  return { deletedIds, failures };
};
