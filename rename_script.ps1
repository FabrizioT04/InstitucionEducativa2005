
$files = Get-ChildItem -Path "src/app" -Recurse -Filter "*.scss"
foreach ($file in $files) {
    $newName = $file.FullName -replace '\.scss$', '.css'
    Rename-Item -Path $file.FullName -NewName $newName
    Write-Host "Renamed $($file.Name) to $($file.Name -replace '\.scss$', '.css')"
}

$tsFiles = Get-ChildItem -Path "src/app" -Recurse -Filter "*.ts"
foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match '\.scss') {
        $newContent = $content -replace '\.scss', '.css'
        Set-Content -Path $file.FullName -Value $newContent
        Write-Host "Updated references in $($file.Name)"
    }
}
