import { describe, it, expect } from "vitest";
import { isSkeletal } from "../snippet-filter";

describe("isSkeletal — JavaScript", () => {
    it("flags empty async function stubs as skeletal", () => {
        const content = "var addTwoPromises = async function(promise1, promise2) {\n    \n};\n";
        expect(isSkeletal(content, "javascript")).toBe(true);
    });

    it("flags empty generator function stubs as skeletal", () => {
        const content = "var fibGenerator = function*() {\n    \n};\n";
        expect(isSkeletal(content, "javascript")).toBe(true);
    });

    it("flags bare function declaration stubs as skeletal", () => {
        const content = "async function sleep(millis) {\n    \n}\n";
        expect(isSkeletal(content, "javascript")).toBe(true);
    });

    it("flags nested return-function stubs as skeletal", () => {
        const content =
            "var createCounter = function(n) {\n    \n    return function() {\n        \n    };\n};\n";
        expect(isSkeletal(content, "javascript")).toBe(true);
    });

    it("flags empty class-method stubs as skeletal", () => {
        const content =
            "class EventEmitter {\n    \n    subscribe(eventName, callback) {\n        \n        return {\n            unsubscribe: () => {\n                \n            }\n        };\n    }\n    \n    emit(eventName, args = []) {\n        \n    }\n}\n";
        expect(isSkeletal(content, "javascript")).toBe(true);
    });

    it("keeps a JavaScript function with a real body", () => {
        const content = "function add(a, b) {\n    return a + b;\n}\n";
        expect(isSkeletal(content, "javascript")).toBe(false);
    });

    it("keeps the classic two-sum signature still skeletal", () => {
        const content = "var twoSum = function(nums, target) {\n};\n";
        expect(isSkeletal(content, "javascript")).toBe(true);
    });
});

describe("isSkeletal — Python", () => {
    it("flags class+def+pass stubs as skeletal", () => {
        const content = "class Solution:\n    def twoSum(self, nums, target):\n        pass\n";
        expect(isSkeletal(content, "python")).toBe(true);
    });

    it("keeps a Python function with a real body", () => {
        const content = "def total(values):\n    return sum(values)\n";
        expect(isSkeletal(content, "python")).toBe(false);
    });
});

describe("isSkeletal — Java", () => {
    it("flags an empty-body Solution stub as skeletal", () => {
        const content =
            "class Solution {\n    public boolean isOneBitCharacter(int[] bits) {\n        \n    }\n}\n";
        expect(isSkeletal(content, "java")).toBe(true);
    });

    it("flags a multi-method empty stub as skeletal", () => {
        const content =
            "class FizzBuzz {\n    private int n;\n\n    public FizzBuzz(int n) {\n    }\n\n    public void fizz(Runnable printFizz) throws InterruptedException {\n    }\n}\n";
        expect(isSkeletal(content, "java")).toBe(true);
    });

    it("keeps a Java method with a real body", () => {
        const content =
            "class Solution {\n    public int add(int a, int b) {\n        return a + b;\n    }\n}\n";
        expect(isSkeletal(content, "java")).toBe(false);
    });

    it("keeps a Java stub that has at least one real statement", () => {
        const content =
            "class Foo {\n    public void first(Runnable printFirst) throws InterruptedException {\n        printFirst.run();\n    }\n}\n";
        expect(isSkeletal(content, "java")).toBe(false);
    });
});

describe("isSkeletal — C++", () => {
    it("flags an empty-body Solution stub (with public: access specifier) as skeletal", () => {
        const content =
            "class Solution {\npublic:\n    bool isOneBitCharacter(vector<int>& bits) {\n        \n    }\n};\n";
        expect(isSkeletal(content, "cpp")).toBe(true);
    });

    it("flags a struct stub with blank body as skeletal", () => {
        const content =
            "struct Node {\npublic:\n    int compute(int x) {\n        \n    }\n};\n";
        expect(isSkeletal(content, "cpp")).toBe(true);
    });

    it("flags an empty multi-line-signature stub as skeletal", () => {
        const content =
            "class DiningPhilosophers {\npublic:\n    void wantsToEat(int philosopher,\n                    function<void()> pickLeftFork,\n                    function<void()> eat) {\n        \n    }\n};\n";
        expect(isSkeletal(content, "cpp")).toBe(true);
    });

    it("keeps a C++ method with a real body", () => {
        const content =
            "class Solution {\npublic:\n    int add(int a, int b) {\n        return a + b;\n    }\n};\n";
        expect(isSkeletal(content, "cpp")).toBe(false);
    });
});
