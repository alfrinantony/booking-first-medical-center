$workspaceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.OperationalInsights/workspaces/law-fmc-booking"

# 1. Storage Account (Blob)
$blobResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.Storage/storageAccounts/stfmcbooking/blobServices/default"
az monitor diagnostic-settings create --name "ASC-Default-Blob" --resource $blobResourceId --workspace $workspaceId --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true},{"category":"StorageDelete","enabled":true}]' --metrics '[{"category":"Transaction","enabled":true}]'

# 2. Storage Account (Queue)
$queueResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.Storage/storageAccounts/stfmcbooking/queueServices/default"
az monitor diagnostic-settings create --name "ASC-Default-Queue" --resource $queueResourceId --workspace $workspaceId --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true},{"category":"StorageDelete","enabled":true}]' --metrics '[{"category":"Transaction","enabled":true}]'

# 3. Storage Account (Table)
$tableResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.Storage/storageAccounts/stfmcbooking/tableServices/default"
az monitor diagnostic-settings create --name "ASC-Default-Table" --resource $tableResourceId --workspace $workspaceId --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true},{"category":"StorageDelete","enabled":true}]' --metrics '[{"category":"Transaction","enabled":true}]'

# 4. Storage Account (File)
$fileResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.Storage/storageAccounts/stfmcbooking/fileServices/default"
az monitor diagnostic-settings create --name "ASC-Default-File" --resource $fileResourceId --workspace $workspaceId --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true},{"category":"StorageDelete","enabled":true}]' --metrics '[{"category":"Transaction","enabled":true}]'

# 5. Cosmos DB
$cosmosResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.DocumentDB/databaseAccounts/db-aoai-fmc-booking-asst"
az monitor diagnostic-settings create --name "ASC-Default-Cosmos" --resource $cosmosResourceId --workspace $workspaceId --logs '[{"categoryGroup":"audit","enabled":true},{"categoryGroup":"allLogs","enabled":true}]' --metrics '[{"category":"Requests","enabled":true}]'

# 6. Cognitive Services (OpenAI)
$openaiResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.CognitiveServices/accounts/aoai-fmc-booking"
az monitor diagnostic-settings create --name "ASC-Default-OpenAI" --resource $openaiResourceId --workspace $workspaceId --logs '[{"categoryGroup":"audit","enabled":true},{"categoryGroup":"allLogs","enabled":true}]' --metrics '[{"category":"AllMetrics","enabled":true}]'

# 7. Front Door
$fdResourceId = "/subscriptions/99aa7eb6-13df-41ca-9e98-2d8792cf2d36/resourceGroups/rg-booking-fmc/providers/Microsoft.Cdn/profiles/fd-fmc-booking"
az monitor diagnostic-settings create --name "ASC-Default-FD" --resource $fdResourceId --workspace $workspaceId --logs '[{"categoryGroup":"audit","enabled":true},{"categoryGroup":"allLogs","enabled":true}]' --metrics '[{"category":"AllMetrics","enabled":true}]'

Write-Host "Diagnostic settings creation completed."
