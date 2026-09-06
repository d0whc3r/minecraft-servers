// Go port of apps/web/src/lib/k8sValues.ts: repo env config (shared .env
// merged with the per-server file, see env.go) -> values for the
// minecraft-server chart. The result is serialized as JSON, which is valid
// YAML, so helm accepts it via --values without any escaping surprises
// (CurseForge keys are full of shell-hostile characters).
package kube

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// imageRepository is the itzg server image the chart runs.
const imageRepository = "itzg/minecraft-server"

// Values with these key patterns go into the rendered Secret, not the
// ConfigMap (the same masking rule the panel applies).
var secretKeyRe = regexp.MustCompile(`(?i)PASSWORD|API_KEY|TOKEN|SECRET`)

var truthyRe = regexp.MustCompile(`(?i)^(true|1|yes|on)$`)

// Keys that only made sense on the docker host or that the chart passes as
// structured values instead (image tag, resources, router annotations, fixed
// ports): the chart wiring overrides them anyway.
var excludedKeys = map[string]bool{
	"MEMORY":            true,
	"JAVA_VERSION":      true,
	"RCON_PORT":         true,
	"SERVER_PORT":       true,
	"MC_ROUTER_DOMAIN":  true,
	"MC_ROUTER_DEFAULT": true,
	"SERVER_NAME":       true,
}

// chartValues mirrors the panel's MinecraftChartValues; the JSON field names
// are the chart's values schema.
type chartValues struct {
	ReplicaCount int `json:"replicaCount"`
	Image        struct {
		Repository string `json:"repository"`
		Tag        string `json:"tag"`
		PullPolicy string `json:"pullPolicy"`
	} `json:"image"`
	Env       map[string]string `json:"env"`
	SecretEnv map[string]string `json:"secretEnv"`
	Router    struct {
		Host    string `json:"host"`
		Default bool   `json:"default"`
	} `json:"router"`
	Resources *resources `json:"resources,omitempty"`
}

type resources struct {
	Requests struct {
		Memory string `json:"memory"`
	} `json:"requests"`
	Limits struct {
		Memory string `json:"memory"`
	} `json:"limits"`
}

// MemoryToK8s converts itzg memory syntax into a Kubernetes quantity:
// "6G" -> "6Gi", "512M" -> "512Mi", plain "1024" is MB (itzg's default
// unit) -> "1024Mi". Returns "" when the value is absent/unparseable so the
// chart default applies.
func MemoryToK8s(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	re := regexp.MustCompile(`^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$`)
	m := re.FindStringSubmatch(raw)
	if m == nil {
		return ""
	}
	n, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return ""
	}
	unit := strings.ToUpper(m[2])
	mi := func(v float64) string {
		return strconv.FormatFloat(float64(int64(v+0.5)), 'f', -1, 64) + "Mi"
	}
	switch unit {
	case "", "M", "MB":
		return mi(n)
	case "G", "GB", "GI":
		return strconv.FormatFloat(n, 'f', -1, 64) + "Gi"
	case "MI":
		return strconv.FormatFloat(n, 'f', -1, 64) + "Mi"
	default:
		return ""
	}
}

// BuildServerValues assembles the chart values for one server. env is the
// merged environment (env.go), connect the player route host
// (<slug>.<MC_ROUTER_DOMAIN>), replicas 0 (stopped) or 1.
func BuildServerValues(env map[string]string, connect string, replicas int) chartValues {
	var values chartValues
	values.ReplicaCount = replicas
	values.Image.Repository = imageRepository
	// JAVA_VERSION doubles as the image tag, like docker-compose does.
	values.Image.Tag = orDefault(env["JAVA_VERSION"], "latest")
	values.Image.PullPolicy = "IfNotPresent"

	plain := map[string]string{}
	secrets := map[string]string{}
	// Deterministic output for tests: iterate sorted keys.
	keys := make([]string, 0, len(env))
	for key := range env {
		if !excludedKeys[key] {
			keys = append(keys, key)
		}
	}
	slices.Sort(keys)
	for _, key := range keys {
		if secretKeyRe.MatchString(key) {
			secrets[key] = env[key]
		} else {
			plain[key] = env[key]
		}
	}
	values.Env = plain
	values.SecretEnv = secrets

	values.Router.Host = connect
	values.Router.Default = truthyRe.MatchString(env["MC_ROUTER_DEFAULT"])

	if memory := MemoryToK8s(env["MEMORY"]); memory != "" {
		// request = limit: the JVM heap is fixed anyway, and the scheduler
		// then never puts more load on a node than the operators asked for.
		values.Resources = &resources{}
		values.Resources.Requests.Memory = memory
		values.Resources.Limits.Memory = memory
	}
	return values
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
