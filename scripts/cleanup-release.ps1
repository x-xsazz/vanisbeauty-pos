# PowerShell script to remove source code archives from GitHub releases
param(
    [string]$version = "v1.0.0"
)

$owner = "x-xsazz"
$repo = "vanisbeauty-pos"
$token = $env:GH_TOKEN

if (-not $token) {
    Write-Host "Error: GH_TOKEN environment variable not set"
    exit 1
}

Write-Host "Cleaning up source code archives for release $version..."

# Get release by tag
$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/tags/$version" -Headers $headers
    $releaseId = $release.id

    Write-Host "Found release ID: $releaseId"

    # Get all assets
    $assets = $release.assets

    # Delete source code archives
    foreach ($asset in $assets) {
        $assetName = $asset.name
        if (($assetName -eq "Source code.zip") -or ($assetName -eq "Source code.tar.gz")) {
            Write-Host "Deleting: $assetName (ID: $($asset.id))"
            Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/assets/$($asset.id)" -Method Delete -Headers $headers
            Write-Host "  Deleted successfully"
        }
    }

    Write-Host ""
    Write-Host "Cleanup complete!"

} catch {
    $errorMessage = $_.Exception.Message
    Write-Host "Error: $errorMessage"
    exit 1
}
