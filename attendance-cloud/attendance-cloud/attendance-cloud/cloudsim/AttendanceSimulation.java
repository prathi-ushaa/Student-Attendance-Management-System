import java.util.*;
import org.cloudbus.cloudsim.*;
import org.cloudbus.cloudsim.core.CloudSim;
import org.cloudbus.cloudsim.provisioners.*;

/**
 * Peak-load simulation for the attendance system (CloudSim 3.0.3).
 * Each "student marking attendance" = 1 cloudlet. Everyone submits at the same moment
 * (start of a period), and we compare VM counts and cloudlet scheduling policies.
 */
public class AttendanceSimulation {

    static final int REQUEST_LENGTH_MI = 2000;   // work per attendance request
    static final double VM_MIPS = 1000;
    static final double COST_PER_VM_SEC = 0.0001; // illustrative rate

    public static void main(String[] args) throws Exception {
        int[] studentCounts = {100, 500, 1000};
        int[] vmCounts = {2, 5, 10};
        String[] policies = {"TimeShared", "SpaceShared"};

        System.out.printf("%-9s %-5s %-12s %-14s %-12s %-10s%n",
                "Students", "VMs", "Scheduler", "AvgResp(s)", "Makespan(s)", "Cost");
        for (int students : studentCounts)
            for (int vms : vmCounts)
                for (String policy : policies)
                    run(students, vms, policy);
    }

    static void run(int students, int vmCount, String policy) throws Exception {
        Log.disable();
        CloudSim.init(1, Calendar.getInstance(), false);

        Datacenter dc = createDatacenter("AttendanceDC");
        DatacenterBroker broker = new DatacenterBroker("Broker");
        int brokerId = broker.getId();

        List<Vm> vms = new ArrayList<>();
        for (int i = 0; i < vmCount; i++) {
            CloudletScheduler cs = policy.equals("TimeShared")
                    ? new CloudletSchedulerTimeShared() : new CloudletSchedulerSpaceShared();
            vms.add(new Vm(i, brokerId, VM_MIPS, 1, 1024, 1000, 10000, "Xen", cs));
        }

        List<Cloudlet> cloudlets = new ArrayList<>();
        UtilizationModel full = new UtilizationModelFull();
        for (int i = 0; i < students; i++) {
            Cloudlet c = new Cloudlet(i, REQUEST_LENGTH_MI, 1, 300, 300, full, full, full);
            c.setUserId(brokerId);
            cloudlets.add(c);
        }

        broker.submitVmList(vms);
        broker.submitCloudletList(cloudlets);
        CloudSim.startSimulation();
        List<Cloudlet> done = broker.getCloudletReceivedList();
        CloudSim.stopSimulation();

        double sum = 0, max = 0;
        int ok = 0;
        for (Cloudlet c : done) {
            if (c.getStatus() == Cloudlet.SUCCESS) {
                sum += c.getFinishTime();
                max = Math.max(max, c.getFinishTime());
                ok++;
            }
        }
        double cost = vmCount * max * COST_PER_VM_SEC;
        System.out.printf("%-9d %-5d %-12s %-14.2f %-12.2f %-10.4f%n",
                students, vmCount, policy, ok == 0 ? 0 : sum / ok, max, cost);
    }

    static Datacenter createDatacenter(String name) throws Exception {
        List<Host> hosts = new ArrayList<>();
        for (int h = 0; h < 4; h++) {
            List<Pe> pes = new ArrayList<>();
            for (int p = 0; p < 8; p++) pes.add(new Pe(p, new PeProvisionerSimple(2000)));
            hosts.add(new Host(h, new RamProvisionerSimple(32768), new BwProvisionerSimple(100000),
                    1000000, pes, new VmSchedulerTimeShared(pes)));
        }
        DatacenterCharacteristics ch = new DatacenterCharacteristics(
                "x86", "Linux", "Xen", hosts, 5.5, 3.0, 0.05, 0.001, 0.0);
        return new Datacenter(name, ch, new VmAllocationPolicySimple(hosts),
                new LinkedList<Storage>(), 0);
    }
}
