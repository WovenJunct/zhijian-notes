package app.zhijian.notes.backup;
public final class ArchivePolicy {
 public static final long MAX_TOTAL=1024L*1024*1024,MAX_IMAGE=20L*1024*1024,MAX_MANIFEST=32L*1024*1024;
 public static void validateEntry(String p,long bytes){
  boolean manifest=p.equals("manifest.json");
  if(!manifest&&!p.matches("media/[a-zA-Z0-9_-]+\\.(png|jpg|jpeg|webp|gif|bin)"))throw new IllegalArgumentException("备份含无效文件路径");
  if(bytes>(manifest?MAX_MANIFEST:MAX_IMAGE))throw new IllegalArgumentException("备份文件大小超出限制");
 }
}
