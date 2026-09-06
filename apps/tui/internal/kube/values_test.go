package kube

import (
	"strings"
	"testing"
)

func TestMemoryToK8s(t *testing.T) {
	cases := map[string]string{
		"6G":   "6Gi",
		"8g":   "8Gi",
		"512M": "512Mi",
		"1024": "1024Mi", // itzg's default unit is MB
		"2GB":  "2Gi",
		"3GI":  "3Gi",
		"1.5G": "1.5Gi",
		"4 Gi": "4Gi",
		"":     "",
		"abc":  "",
		"12X":  "",
		"G":    "",
		"-4G":  "",
	}
	for raw, want := range cases {
		if got := MemoryToK8s(raw); got != want {
			t.Errorf("MemoryToK8s(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestBuildServerValues(t *testing.T) {
	env := map[string]string{
		"TYPE":              "AUTO_CURSEFORGE",
		"CF_PAGE_URL":       "https://www.curseforge.com/minecraft/modpacks/dawn-craft",
		"VERSION":           "1.18.2",
		"JAVA_VERSION":      "java17",
		"MEMORY":            "8G",
		"MAX_PLAYERS":       "20",
		"RCON_PASSWORD":     "s3cret",
		"CF_API_KEY":        "$2a$10$xyz",
		"ENABLE_RCON":       "true",
		"MC_ROUTER_DEFAULT": "true",
		"SERVER_MEMO":       "keep me",
	}

	values := BuildServerValues(env, "dawncraft.mc.local", 1)

	if values.ReplicaCount != 1 {
		t.Errorf("replicaCount = %d, want 1", values.ReplicaCount)
	}
	if values.Image.Repository != imageRepository {
		t.Errorf("image repository = %q", values.Image.Repository)
	}
	if values.Image.Tag != "java17" {
		t.Errorf("JAVA_VERSION must double as the image tag, got %q", values.Image.Tag)
	}
	if values.Image.PullPolicy != "IfNotPresent" {
		t.Errorf("pullPolicy = %q", values.Image.PullPolicy)
	}
	if values.Router.Host != "dawncraft.mc.local" || !values.Router.Default {
		t.Errorf("router = %+v, want host dawncraft.mc.local + default", values.Router)
	}

	// Secret split: sensitive keys to secretEnv, everything else to env.
	for _, key := range []string{"RCON_PASSWORD", "CF_API_KEY"} {
		if _, ok := values.SecretEnv[key]; !ok {
			t.Errorf("%s must land in secretEnv", key)
		}
		if _, ok := values.Env[key]; ok {
			t.Errorf("%s must not leak into env", key)
		}
	}
	for _, key := range []string{"TYPE", "CF_PAGE_URL", "SERVER_MEMO"} {
		if values.Env[key] != env[key] {
			t.Errorf("env[%s] = %q, want %q", key, values.Env[key], env[key])
		}
	}
	if _, ok := values.SecretEnv["TYPE"]; ok {
		t.Error("TYPE must not land in secretEnv")
	}

	// Excluded keys never reach either map.
	for _, key := range []string{"MEMORY", "JAVA_VERSION", "RCON_PORT", "SERVER_PORT", "MC_ROUTER_DOMAIN", "MC_ROUTER_DEFAULT", "SERVER_NAME"} {
		if _, ok := values.Env[key]; ok {
			t.Errorf("excluded key %s leaked into env", key)
		}
		if _, ok := values.SecretEnv[key]; ok {
			t.Errorf("excluded key %s leaked into secretEnv", key)
		}
	}

	// Memory becomes a request=limit pair.
	if values.Resources == nil || values.Resources.Requests.Memory != "8Gi" || values.Resources.Limits.Memory != "8Gi" {
		t.Errorf("resources = %+v, want 8Gi request=limit", values.Resources)
	}

	// No memory configured: the chart default applies.
	values = BuildServerValues(map[string]string{"TYPE": "PAPER"}, "x.mc.local", 0)
	if values.Resources != nil {
		t.Errorf("resources = %+v, want nil without MEMORY", values.Resources)
	}
	if values.Image.Tag != "latest" {
		t.Errorf("image tag = %q, want latest without JAVA_VERSION", values.Image.Tag)
	}
	if values.ReplicaCount != 0 || strings.Contains(values.Router.Host, "!") {
		t.Errorf("stopped release values wrong: %+v", values)
	}
}
