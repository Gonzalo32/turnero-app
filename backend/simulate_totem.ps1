$body = @{
    _id = "sim_" + (Get-Date -UFormat %s)
    dni = "12345678"
    nombre = "Carlos"
    apellido = "Simulador"
    obraSocial = "OSDE"
    profesional = "Beatriz Baleiron"
} | ConvertTo-Json

# Usa la misma clave que TOTEM_API_KEY en backend/.env
$headers = @{ "x-totem-api-key" = $env:TOTEM_API_KEY }

Invoke-RestMethod -Uri http://localhost:3001/api/v1/integrations/totem/patient -Method POST -Body $body -ContentType "application/json" -Headers $headers
Write-Host "Simulación enviada exitosamente. Revisa el frontend para ver si el paciente 'Carlos Simulador' apareció en la cola de Beatriz Baleiron."
