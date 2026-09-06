package kube

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

// fakeCluster installs kubectl/helm stubs on PATH that log their arguments
// and answer from fixtures, so the tests pin the exact commands the k8s
// runtime runs without a cluster. The list fixture holds every deployment
// `kubectl get deployments` reports; a single `get deployment <name>` answers
// from the running fixture when the name is in that list, from the stopped
// fixture for mc-stopped, and exits 1 (NotFound) otherwise.
func fakeCluster(t *testing.T, listJSON string) string {
	t.Helper()
	bin := t.TempDir()
	log := filepath.Join(bin, "calls.log")

	write := func(name, body string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(bin, name), []byte(body), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	abs := func(name string) string { return filepath.Join(bin, name) }

	write("list.json", listJSON)
	write("one.json", `{"metadata":{"name":"mc-vanilla"},
		"spec":{"replicas":1},
		"status":{"readyReplicas":1,"conditions":[{"type":"Ready","lastTransitionTime":"2026-09-06T10:00:00Z"}]}}`)
	write("stopped.json", `{"metadata":{"name":"mc-stopped"},"spec":{"replicas":0},"status":{}}`)

	write("kubectl", "#!/usr/bin/env bash\n"+
		"echo \"kubectl $*\" >> "+abs("calls.log")+"\n"+
		"if [ \"$1\" = get ] && [ \"$2\" = deployments ]; then cat "+abs("list.json")+"; exit 0; fi\n"+
		"if [ \"$1\" = get ] && [ \"$2\" = deployment ]; then\n"+
		"  if grep -q \"\\\"$3\\\"\" "+abs("list.json")+"; then\n"+
		"    if [ \"$3\" = mc-stopped ]; then cat "+abs("stopped.json")+"; else cat "+abs("one.json")+"; fi\n"+
		"    exit 0\n"+
		"  fi\n"+
		"  exit 1\n"+
		"fi\n")

	write("helm", "#!/usr/bin/env bash\n"+
		"prev=\"\"\n"+
		"for a in \"$@\"; do\n"+
		"  if [ \"$prev\" = --values ]; then { echo ---VALUES---; cat \"$a\"; } >> "+abs("calls.log")+"; fi\n"+
		"  prev=\"$a\"\n"+
		"done\n"+
		"echo \"helm $*\" >> "+abs("calls.log")+"\n")

	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("MCPANEL_K8S_NAMESPACE", "minecraft")
	return log
}

// The cluster behind the fixtures: vanilla up, stopped scaled to 0.
const deploymentsListJSON = `{"items":[
  {"metadata":{"name":"mc-vanilla"},
   "spec":{"replicas":1},
   "status":{"readyReplicas":1,"conditions":[{"type":"Ready","lastTransitionTime":"2026-09-06T10:00:00Z"}]}},
  {"metadata":{"name":"mc-stopped"},
   "spec":{"replicas":0},
   "status":{}}
]}`

func catalogRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	writeEnvFile(t, filepath.Join(root, ".env"), "MC_ROUTER_DOMAIN=test.local\nRCON_PASSWORD=shared-secret\n")
	writeEnvFile(t, filepath.Join(root, "config", "modpacks", "vanilla.env"),
		"TYPE=PAPER\nJAVA_VERSION=java21\nMEMORY=4G\n")
	writeEnvFile(t, filepath.Join(root, "config", "modpacks", "newpack.env"),
		"TYPE=AUTO_CURSEFORGE\nSERVER_NAME=newname\nJAVA_VERSION=java17\nMEMORY=6G\nCF_API_KEY=key-123\n")
	return root
}

func readLog(t *testing.T, log string) string {
	t.Helper()
	data, err := os.ReadFile(log)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestStatesTranslation(t *testing.T) {
	fakeCluster(t, deploymentsListJSON)

	states, err := States()
	if err != nil {
		t.Fatal(err)
	}
	if len(states) != 2 {
		t.Fatalf("States returned %d entries, want 2 (release prefix stripped)", len(states))
	}
	running := states["vanilla"]
	if running.State != "running" || running.Health != "healthy" || !strings.Contains(running.Status, "Ready 1/1") {
		t.Errorf("vanilla state = %+v, want running/healthy Ready 1/1", running)
	}
	stopped := states["stopped"]
	if stopped.State != "exited" || stopped.Status != "Stopped (scaled to 0)" {
		t.Errorf("stopped state = %+v", stopped)
	}
}

func TestStartExistingReleaseScalesWithReuseValues(t *testing.T) {
	log := fakeCluster(t, deploymentsListJSON)
	root := catalogRoot(t)

	out, err := Run(context.Background(), root, domain.ActionStart, "stopped")
	if err != nil {
		t.Fatalf("start stopped: %v (out: %s)", err, out)
	}
	calls := readLog(t, log)
	if !strings.Contains(calls, "helm upgrade mc-stopped "+filepath.Join(root, "charts", "minecraft-server")) {
		t.Errorf("start must helm-upgrade the release chart, log:\n%s", calls)
	}
	if !strings.Contains(calls, "--reuse-values") || !strings.Contains(calls, "replicaCount=1") {
		t.Errorf("start of a stopped release must flip replicaCount=1 with --reuse-values, log:\n%s", calls)
	}
}

func TestStartNewDeploysValuesBuiltFromEnvFiles(t *testing.T) {
	log := fakeCluster(t, deploymentsListJSON)
	root := catalogRoot(t)

	out, err := Run(context.Background(), root, domain.ActionStart, "newpack")
	if err != nil {
		t.Fatalf("start newpack: %v (out: %s)", err, out)
	}
	calls := readLog(t, log)
	if !strings.Contains(calls, "helm upgrade --install mc-newpack") {
		t.Errorf("first start must create the release, log:\n%s", calls)
	}
	if !strings.Contains(calls, "---VALUES---") {
		t.Fatalf("start must pass a values file, log:\n%s", calls)
	}
	values := calls[strings.Index(calls, "---VALUES---"):]
	for _, want := range []string{
		`"replicaCount":1`,
		`"tag":"java17"`, // JAVA_VERSION doubles as the image tag
		`"host":"newname.test.local"`,
		`"RCON_PASSWORD":"shared-secret"`, // secret split from the shared .env
		`"CF_API_KEY":"key-123"`,
		`"requests":{"memory":"6Gi"`,
		`"TYPE":"AUTO_CURSEFORGE"`,
	} {
		if !strings.Contains(values, want) {
			t.Errorf("built values missing %s:\n%s", want, values)
		}
	}
}

func TestStopUndeployedIsNoop(t *testing.T) {
	log := fakeCluster(t, deploymentsListJSON)

	out, err := Run(context.Background(), catalogRoot(t), domain.ActionStop, "newpack")
	if err != nil {
		t.Fatalf("stop of an undeployed server must be a no-op, got %v", err)
	}
	if !strings.Contains(out, "not deployed") {
		t.Errorf("output = %q, want a not-deployed note", out)
	}
	if strings.Contains(readLog(t, log), "helm upgrade") {
		t.Error("stop must not touch helm when there is no release")
	}
}

func TestRestartRunningRollsDeployment(t *testing.T) {
	log := fakeCluster(t, deploymentsListJSON)

	if _, err := Run(context.Background(), catalogRoot(t), domain.ActionRestart, "vanilla"); err != nil {
		t.Fatal(err)
	}
	if calls := readLog(t, log); !strings.Contains(calls, "kubectl rollout restart deployment/mc-vanilla") {
		t.Errorf("restart of a running deployment must roll it, log:\n%s", calls)
	}
}

func TestRestartStoppedStartsRelease(t *testing.T) {
	log := fakeCluster(t, deploymentsListJSON)

	if _, err := Run(context.Background(), catalogRoot(t), domain.ActionRestart, "stopped"); err != nil {
		t.Fatal(err)
	}
	calls := readLog(t, log)
	if strings.Contains(calls, "rollout restart") {
		t.Error("a scaled-to-0 release has no rollout to restart")
	}
	if !strings.Contains(calls, "--reuse-values") || !strings.Contains(calls, "replicaCount=1") {
		t.Errorf("restart of a stopped release must start it, log:\n%s", calls)
	}
}

func TestStartAllSkipsUndeployedStopAllScalesEverything(t *testing.T) {
	log := fakeCluster(t, deploymentsListJSON)
	root := catalogRoot(t)

	// vanilla is already running in the fixture: start-all has nothing to
	// scale and must not bulk-create releases for packs never deployed.
	out, err := Run(context.Background(), root, domain.ActionStartAll, "")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "newpack: not deployed") {
		t.Errorf("start-all must leave never-deployed packs alone, out:\n%s", out)
	}
	if calls := readLog(t, log); strings.Contains(calls, "helm upgrade") {
		t.Errorf("start-all must not touch running or undeployed servers, log:\n%s", calls)
	}

	// stop-all: every deployed release goes to 0 (vanilla is the only one).
	if _, err := Run(context.Background(), root, domain.ActionStopAll, ""); err != nil {
		t.Fatal(err)
	}
	calls := readLog(t, log)
	if strings.Count(calls, "replicaCount=0") != 1 || strings.Contains(calls, "helm upgrade mc-newpack") {
		t.Errorf("stop-all must scale only the deployed releases to 0, log:\n%s", calls)
	}
}
