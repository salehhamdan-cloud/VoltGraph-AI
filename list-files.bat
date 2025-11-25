@echo off
echo =============================================
echo 📂 Generating list of all files and folders...
echo =============================================

set OUTPUT=list.txt

REM حذف الملف السابق إن وُجد
if exist "%OUTPUT%" del "%OUTPUT%"

REM إنشاء القائمة الكاملة بجميع الملفات والمجلدات
tree /f /a > "%OUTPUT%"

echo.
echo ✅ Done! File saved as "%OUTPUT%"
echo =============================================
echo Open "%OUTPUT%" to view the list.
pause
