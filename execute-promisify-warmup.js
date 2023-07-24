
((ivm) => {
    delete _ivm;

    function promisify(O) {
        let mO;
        if (!O) { return O }
        if (!Array.isArray(O)) {
            mO = {}
            Object.keys(O).forEach(k => {
                if (typeof O[k] == 'string') {

                    if (O[k].startsWith("glome-internal:")) {
                        let func = internals.getSync(O[k].split(":")[1])
                        mO[k] = (...args) => {
                            return new Promise((resolve, reject) => {
                                func(new ivm.Reference((res) => {
                                    resolve(res)
                                }), new ivm.Reference((err) => {
                                    reject(err)
                                }), args)
                            })
                        }

                    } else {
                        mO[k] = O[k]
                    }

                } else if (typeof O[k] == "object") {
                    mO[k] = promisify(O[k])
                } else {
                    mO[k] = O[k]
                }
            })
        } else {
            mO = [];
            O.forEach((el, elIndex) => {
                if (typeof el == "string") {
                    if (el.startsWith("glome-internal:")) {
                        let func = internals.getSync(el.split(":")[1])
                        mO.push((...args) => {
                            return new Promise((resolve, reject) => {
                                func(new ivm.Reference((res) => {
                                    resolve(res)
                                }), new ivm.Reference((err) => {
                                    reject(err)
                                }), args)
                            })
                        })
                    } else {
                        mO.push(el)
                    }

                } else if (typeof el == "object") {
                    mO.push(promisify(el))
                } else {
                    mO.push(el)
                }
            })
        }

        return mO
    }
    SmartWeave = promisify(SmartWeave)
    delete internals
})(_ivm);
// console.log(typeof _ivm)