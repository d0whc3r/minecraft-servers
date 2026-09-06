{{- define "web-panel.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "web-panel.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else if .Values.nameOverride -}}
{{- .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "web-panel.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "web-panel.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: minecraft-servers
{{- with .Values.podLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "web-panel.selectorLabels" -}}
app.kubernetes.io/name: {{ include "web-panel.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "web-panel.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "web-panel.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "web-panel.sharedEnvSecretName" -}}
{{- if .Values.existingSharedEnvSecret -}}
{{- .Values.existingSharedEnvSecret -}}
{{- else -}}
{{- include "web-panel.fullname" . -}}-env
{{- end -}}
{{- end -}}

{{- define "web-panel.secretName" -}}
{{- include "web-panel.fullname" . -}}
{{- end -}}
