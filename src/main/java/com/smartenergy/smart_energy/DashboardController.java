
package com.smartenergy.smart_energy;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@CrossOrigin(origins = {
    "http://127.0.0.1:5500",
    "http://localhost:5500"
})
public class DashboardController {

    private final double tariff = 8.0;
    private boolean occupied = true;

    private final List<Map<String, Object>> appliances =
            new ArrayList<>();

    public DashboardController() {
        addAppliance(1, "Ceiling Fan", 75.0, 0.34, 0.42);
        addAppliance(2, "LED Light", 18.0, 0.08, 0.12);
        addAppliance(3, "Air Conditioner", 1200.0, 5.22, 2.80);
    }

    private void addAppliance(
            int id, String name, double power,
            double current, double energy) {

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("name", name);
        item.put("power", power);
        item.put("current", current);
        item.put("energy", energy);
        item.put("status", "ON");

        appliances.add(item);
    }

    private List<String> getAlerts() {
        List<String> alerts = new ArrayList<>();

        if (!occupied) {
            for (Map<String, Object> item : appliances) {
                if ("ON".equals(item.get("status"))) {
                    alerts.add((String) item.get("name"));
                }
            }
        }

        return alerts;
    }

    @GetMapping("/api/dashboard")
    public Map<String, Object> getDashboard() {

        double totalPower = 0;
        double totalEnergy = 0;

        for (Map<String, Object> item : appliances) {
            if ("ON".equals(item.get("status"))) {
                totalPower += (double) item.get("power");
                totalEnergy += (double) item.get("energy");
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("project", "Smart Energy Management System");
        result.put("voltage", 230);
        result.put("total_power", totalPower);
        result.put("total_energy", totalEnergy);
        result.put("tariff", tariff);
        result.put("estimated_cost", totalEnergy * tariff);
        result.put("occupied", occupied);
        result.put("wastage_alerts", getAlerts());
        result.put("appliances", appliances);

        return result;
    }

    @PostMapping("/api/occupancy/{state}")
    public Map<String, Object> setOccupancy(
            @PathVariable String state) {

        if (!state.equals("occupied") && !state.equals("empty")) {
            throw new IllegalArgumentException(
                    "State must be occupied or empty");
        }

        occupied = state.equals("occupied");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("occupied", occupied);
        result.put("wastage_alerts", getAlerts());
        result.put("message", occupied ? "Room occupied" : "Room empty");

        return result;
    }

    @PostMapping("/api/appliances/{id}/{state}")
    public Map<String, Object> setApplianceStatus(
            @PathVariable int id,
            @PathVariable String state) {

        if (!state.equals("on") && !state.equals("off")) {
            throw new IllegalArgumentException(
                    "State must be on or off");
        }

        for (Map<String, Object> item : appliances) {
            if ((int) item.get("id") == id) {

                item.put("status", state.equals("on") ? "ON" : "OFF");

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("message", item.get("name") + " turned " + state);
                result.put("appliance", item);
                return result;
            }
        }

        throw new NoSuchElementException("Appliance not found");
    }
}